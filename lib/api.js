/**
 * Ghost Admin API модуль
 * Обеспечивает авторизацию через JWT и получение данных о постах
 */

class GhostAPI {
  constructor(blogUrl, apiKey) {
    this.blogUrl = blogUrl.replace(/\/$/, '');
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
      '/posts/?filter=status:scheduled&order=published_at%20asc&fields=id,title,slug,published_at,feature_image,custom_excerpt&limit=all'
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
  const { blogUrl, apiKey } = await chrome.storage.sync.get(['blogUrl', 'apiKey']);

  if (!blogUrl || !apiKey) {
    throw new Error('Настройки не заполнены. Откройте настройки расширения.');
  }

  return new GhostAPI(blogUrl, apiKey);
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GhostAPI, createAPIFromStorage };
}
