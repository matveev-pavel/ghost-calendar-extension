const form = document.getElementById('settings-form');
const blogUrlInput = document.getElementById('blog-url');
const apiKeyInput = document.getElementById('api-key');
const testBtn = document.getElementById('test-btn');
const statusDiv = document.getElementById('status');
const openIntegrationsLink = document.getElementById('open-integrations');

// Валидация URL блога
function validateBlogUrl(url) {
  if (!url) {
    throw new Error('URL блога не указан');
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      throw new Error('URL должен использовать HTTPS для безопасного соединения');
    }
    // Возвращаем нормализованный origin без trailing slash
    return parsed.origin;
  } catch (e) {
    if (e.message.includes('HTTPS')) {
      throw e;
    }
    throw new Error('Неверный формат URL блога');
  }
}

// Загрузка сохранённых настроек
async function loadSettings() {
  const { blogUrl, apiKey } = await chrome.storage.local.get(['blogUrl', 'apiKey']);
  if (blogUrl) blogUrlInput.value = blogUrl;
  if (apiKey) apiKeyInput.value = apiKey;
}

// Показать статус
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
}

// Скрыть статус
function hideStatus() {
  statusDiv.className = 'status';
}

// Генерация JWT токена для Ghost Admin API
async function generateToken(apiKey) {
  const [id, secret] = apiKey.split(':');
  if (!id || !secret) {
    throw new Error('Неверный формат API ключа');
  }

  // Валидация hex-формата secret
  if (!/^[a-f0-9]+$/i.test(secret)) {
    throw new Error('Неверный формат secret. Secret должен быть в hex формате');
  }

  if (secret.length % 2 !== 0) {
    throw new Error('Неверная длина secret. Длина должна быть чётной');
  }

  // Декодируем hex secret в байты
  const keyBytes = new Uint8Array(secret.match(/.{2}/g).map(byte => parseInt(byte, 16)));

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
  const payload = { iat: now, exp: now + 300, aud: '/admin/' };

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

  return `${message}.${signatureB64}`;
}

// Тестирование подключения
async function testConnection() {
  const apiKey = apiKeyInput.value.trim();

  if (!blogUrlInput.value.trim() || !apiKey) {
    showStatus('Заполните все поля', 'error');
    return false;
  }

  let blogUrl;
  try {
    blogUrl = validateBlogUrl(blogUrlInput.value.trim());
  } catch (e) {
    showStatus(e.message, 'error');
    return false;
  }

  showStatus('Проверка подключения...', 'loading');

  try {
    const token = await generateToken(apiKey);
    const response = await fetch(`${blogUrl}/ghost/api/admin/posts/?limit=1`, {
      headers: {
        'Authorization': `Ghost ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.errors?.[0]?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    showStatus(`Подключено! Найдено постов: ${data.meta?.pagination?.total || 0}`, 'success');
    return true;
  } catch (error) {
    showStatus(`Ошибка: ${error.message}`, 'error');
    return false;
  }
}

// Сохранение настроек
async function saveSettings(e) {
  e.preventDefault();

  const apiKey = apiKeyInput.value.trim();

  if (!blogUrlInput.value.trim() || !apiKey) {
    showStatus('Заполните все поля', 'error');
    return;
  }

  let blogUrl;
  try {
    blogUrl = validateBlogUrl(blogUrlInput.value.trim());
  } catch (e) {
    showStatus(e.message, 'error');
    return;
  }

  showStatus('Сохранение...', 'loading');

  try {
    await chrome.storage.local.set({ blogUrl, apiKey });
    showStatus('Настройки сохранены!', 'success');
  } catch (error) {
    showStatus(`Ошибка сохранения: ${error.message}`, 'error');
  }
}

// Открыть страницу интеграций Ghost
function openIntegrations(e) {
  e.preventDefault();
  try {
    const blogUrl = validateBlogUrl(blogUrlInput.value.trim());
    chrome.tabs.create({ url: `${blogUrl}/ghost/#/settings/integrations` });
  } catch (err) {
    showStatus(err.message || 'Сначала введите URL блога', 'error');
  }
}

// Обработчики событий
form.addEventListener('submit', saveSettings);
testBtn.addEventListener('click', testConnection);
openIntegrationsLink.addEventListener('click', openIntegrations);

// Загрузка настроек при открытии страницы
loadSettings();
