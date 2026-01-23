/**
 * Ghost Admin API модуль
 * Обеспечивает авторизацию через JWT и получение данных о постах
 */

class GhostAPI {
  constructor(blogUrl, apiKey) {
    // Проверка HTTPS для предотвращения MITM атак
    const normalizedUrl = blogUrl.replace(/\/$/, '');
    try {
      const parsed = new URL(normalizedUrl);
      if (parsed.protocol !== 'https:') {
        throw new Error('URL блога должен использовать HTTPS для безопасного соединения');
      }
    } catch (e) {
      if (e.message.includes('HTTPS')) {
        throw e;
      }
      throw new Error('Неверный формат URL блога');
    }

    this.blogUrl = normalizedUrl;
    this.apiKey = apiKey;
    this.token = null;
    this.tokenExp = 0;
  }

  /**
   * Генерация JWT токена для Ghost Admin API
   */
  async generateToken() {
    const [id, secret] = this.apiKey.split(':');
    if (!id || !secret) {
      throw new Error('Неверный формат API ключа. Ожидается формат: id:secret');
    }

    // Валидация hex-формата secret
    if (!/^[a-f0-9]+$/i.test(secret)) {
      throw new Error('Неверный формат secret в API ключе. Secret должен быть в hex формате');
    }

    if (secret.length % 2 !== 0) {
      throw new Error('Неверная длина secret в API ключе. Длина должна быть чётной');
    }

    // Декодируем hex secret в байты
    const keyBytes = new Uint8Array(
      secret.match(/.{2}/g).map(byte => parseInt(byte, 16))
    );

    // Импортируем ключ для HMAC
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Создаём header и payload
    const header = { alg: 'HS256', typ: 'JWT', kid: id };
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 300; // 5 минут
    const payload = { iat: now, exp, aud: '/admin/' };

    // Base64URL encode
    const base64UrlEncode = (obj) => {
      const str = JSON.stringify(obj);
      const base64 = btoa(str);
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };

    const headerB64 = base64UrlEncode(header);
    const payloadB64 = base64UrlEncode(payload);
    const message = `${headerB64}.${payloadB64}`;

    // Подписываем
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    this.token = `${message}.${signatureB64}`;
    this.tokenExp = exp;

    return this.token;
  }

  /**
   * Получение актуального токена (с автоматическим обновлением)
   */
  async getToken() {
    const now = Math.floor(Date.now() / 1000);
    if (!this.token || now >= this.tokenExp - 30) {
      await this.generateToken();
    }
    return this.token;
  }

  /**
   * Выполнение запроса к Ghost Admin API
   */
  async request(endpoint, options = {}) {
    const token = await this.getToken();
    const url = `${this.blogUrl}/ghost/api/admin${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Ghost ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = error.errors?.[0]?.message || `HTTP ${response.status}`;
      throw new Error(message);
    }

    return response.json();
  }

  /**
   * Получение запланированных постов
   */
  async getScheduledPosts() {
    const data = await this.request(
      '/posts/?filter=status:scheduled&order=published_at%20asc&fields=id,title,slug,status,published_at,feature_image,custom_excerpt,updated_at&include=tags&limit=all'
    );
    return data.posts || [];
  }

  /**
   * Получение актуального updated_at поста
   */
  async getPostUpdatedAt(postId) {
    const data = await this.request(`/posts/${postId}/?fields=id,updated_at`);
    return data.posts[0].updated_at;
  }

  /**
   * Обновление даты публикации поста
   */
  async updatePostDate(postId, newDate) {
    const updatedAt = await this.getPostUpdatedAt(postId);
    const data = await this.request(`/posts/${postId}/`, {
      method: 'PUT',
      body: JSON.stringify({
        posts: [{
          published_at: newDate,
          updated_at: updatedAt
        }]
      })
    });
    return data.posts[0];
  }

  /**
   * Обновление тегов поста
   */
  async updatePostTags(postId, tags) {
    const updatedAt = await this.getPostUpdatedAt(postId);
    const data = await this.request(`/posts/${postId}/`, {
      method: 'PUT',
      body: JSON.stringify({
        posts: [{
          tags: tags.map(t => typeof t === 'string' ? { name: t } : t),
          updated_at: updatedAt
        }]
      })
    });
    return data.posts[0];
  }

  /**
   * Получение всех тегов блога
   */
  async getAllTags() {
    const data = await this.request('/tags/?limit=all&fields=id,name,slug');
    return data.tags || [];
  }

  /**
   * Получение опубликованных постов начиная с указанной даты
   */
  async getPublishedPosts(since) {
    const fromDate = since || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    fromDate.setHours(0, 0, 0, 0);
    const filter = `status:published+published_at:>='${fromDate.toISOString()}'`;
    const data = await this.request(
      `/posts/?filter=${encodeURIComponent(filter)}&order=published_at%20asc&fields=id,title,slug,status,published_at,feature_image,custom_excerpt,updated_at&include=tags&limit=all`
    );
    return data.posts || [];
  }

  /**
   * Получение всех постов (для отладки)
   */
  async getAllPosts(limit = 15) {
    const data = await this.request(
      `/posts/?order=published_at%20desc&fields=id,title,slug,status,published_at&limit=${limit}`
    );
    return data.posts || [];
  }

  /**
   * Получение URL редактора для поста
   */
  getEditorUrl(postId) {
    return `${this.blogUrl}/ghost/#/editor/post/${postId}`;
  }
}

// Вспомогательная функция для создания API из storage
async function createAPIFromStorage() {
  const { blogUrl, apiKey } = await chrome.storage.local.get(['blogUrl', 'apiKey']);

  if (!blogUrl || !apiKey) {
    throw new Error('Настройки не заполнены. Откройте настройки расширения.');
  }

  return new GhostAPI(blogUrl, apiKey);
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GhostAPI, createAPIFromStorage };
}
