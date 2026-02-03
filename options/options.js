const form = document.getElementById('settings-form');
const blogUrlInput = document.getElementById('blog-url');
const apiKeyInput = document.getElementById('api-key');
const testBtn = document.getElementById('test-btn');
const statusDiv = document.getElementById('status');
const openIntegrationsLink = document.getElementById('open-integrations');
const languageSelect = document.getElementById('language');

// AI Settings elements
const openrouterKeyInput = document.getElementById('openrouter-key');
const modelFilterSelect = document.getElementById('model-filter');
const openrouterModelSelect = document.getElementById('openrouter-model');
const generationLanguageSelect = document.getElementById('generation-language');
const customPromptTextarea = document.getElementById('custom-prompt');

// Инициализация аналитики
analytics.init().then(() => {
  analytics.trackPageView('options');
});

// Blog URL validation
function validateBlogUrl(url) {
  if (!url) {
    throw new Error(t('errBlogUrlRequired'));
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      throw new Error(t('errHttpsRequired'));
    }
    // Return normalized origin without trailing slash
    return parsed.origin;
  } catch (e) {
    if (e.message === t('errHttpsRequired')) {
      throw e;
    }
    throw new Error(t('errInvalidUrl'));
  }
}

// Load OpenRouter models based on filter
async function loadModels(filter = 'recommended') {
  const apiKey = openrouterKeyInput.value.trim();

  openrouterModelSelect.innerHTML = '<option value="">Loading...</option>';
  openrouterModelSelect.disabled = true;

  try {
    let models;
    if (filter === 'recommended') {
      models = RECOMMENDED_MODELS;
    } else if (apiKey) {
      const api = new OpenRouterAPI(apiKey);
      models = await api.getModels(filter);
    } else {
      models = RECOMMENDED_MODELS;
      showStatus(t('errOpenRouterKeyRequired'), 'error');
    }

    openrouterModelSelect.innerHTML = models
      .map(m => `<option value="${m.id}">${m.name}</option>`)
      .join('');

    // Restore saved model selection
    const { openrouterModel } = await chrome.storage.local.get(['openrouterModel']);
    if (openrouterModel) {
      openrouterModelSelect.value = openrouterModel;
    }
  } catch (error) {
    console.error('Error loading models:', error);
    openrouterModelSelect.innerHTML = RECOMMENDED_MODELS
      .map(m => `<option value="${m.id}">${m.name}</option>`)
      .join('');
  } finally {
    openrouterModelSelect.disabled = false;
  }
}

// Load saved settings
async function loadSettings() {
  // Инициализация локализации
  await initI18n();

  const settings = await chrome.storage.local.get([
    'blogUrl', 'apiKey', 'language',
    'openrouterApiKey', 'openrouterModel', 'openrouterLanguage',
    'openrouterCustomPrompt', 'openrouterModelFilter'
  ]);

  if (settings.blogUrl) blogUrlInput.value = settings.blogUrl;
  if (settings.apiKey) apiKeyInput.value = settings.apiKey;
  if (settings.language) languageSelect.value = settings.language;

  // AI Settings
  if (settings.openrouterApiKey) openrouterKeyInput.value = settings.openrouterApiKey;
  if (settings.openrouterModelFilter) modelFilterSelect.value = settings.openrouterModelFilter;
  if (settings.openrouterLanguage) generationLanguageSelect.value = settings.openrouterLanguage;
  if (settings.openrouterCustomPrompt) customPromptTextarea.value = settings.openrouterCustomPrompt;

  applyTranslations();

  // Load models after settings loaded
  await loadModels(settings.openrouterModelFilter || 'recommended');
  if (settings.openrouterModel) {
    openrouterModelSelect.value = settings.openrouterModel;
  }
}

// Show status
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
}

// Hide status
function hideStatus() {
  statusDiv.className = 'status';
}

// Generate JWT token for Ghost Admin API
async function generateToken(apiKey) {
  const [id, secret] = apiKey.split(':');
  if (!id || !secret) {
    throw new Error(t('errInvalidApiKey'));
  }

  // Validate hex format of secret
  if (!/^[a-f0-9]+$/i.test(secret)) {
    throw new Error(t('errInvalidSecret'));
  }

  if (secret.length % 2 !== 0) {
    throw new Error(t('errInvalidSecretLength'));
  }

  // Decode hex secret to bytes
  const keyBytes = new Uint8Array(secret.match(/.{2}/g).map(byte => parseInt(byte, 16)));

  // Import key for HMAC
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Create header and payload
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

  // Sign
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${message}.${signatureB64}`;
}

// Test connection
async function testConnection() {
  const apiKey = apiKeyInput.value.trim();

  if (!blogUrlInput.value.trim() || !apiKey) {
    showStatus(t('errFillAllFields'), 'error');
    return false;
  }

  let blogUrl;
  try {
    blogUrl = validateBlogUrl(blogUrlInput.value.trim());
  } catch (e) {
    showStatus(e.message, 'error');
    return false;
  }

  showStatus(t('msgTesting'), 'loading');

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
    showStatus(t('msgConnected', [String(data.meta?.pagination?.total || 0)]), 'success');

    // Analytics: успешное тестирование соединения
    analytics.trackConnectionTest(true);
    return true;
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');

    // Analytics: неуспешное тестирование соединения
    analytics.trackConnectionTest(false);
    analytics.trackError('connection_test', error.message);
    return false;
  }
}

// Save settings
async function saveSettings(e) {
  e.preventDefault();

  const apiKey = apiKeyInput.value.trim();

  if (!blogUrlInput.value.trim() || !apiKey) {
    showStatus(t('errFillAllFields'), 'error');
    return;
  }

  let blogUrl;
  try {
    blogUrl = validateBlogUrl(blogUrlInput.value.trim());
  } catch (e) {
    showStatus(e.message, 'error');
    return;
  }

  showStatus(t('msgSaving'), 'loading');

  try {
    await chrome.storage.local.set({ blogUrl, apiKey });

    // Save AI settings
    await chrome.storage.local.set({
      openrouterApiKey: openrouterKeyInput.value.trim(),
      openrouterModel: openrouterModelSelect.value,
      openrouterModelFilter: modelFilterSelect.value,
      openrouterLanguage: generationLanguageSelect.value,
      openrouterCustomPrompt: customPromptTextarea.value.trim()
    });

    showStatus(t('msgSaved'), 'success');

    // Analytics: сохранение настроек
    analytics.trackSettingsSave();
  } catch (error) {
    showStatus(t('msgSaveError', [error.message]), 'error');
    analytics.trackError('settings_save', error.message);
  }
}

// Open Ghost integrations page
function openIntegrations(e) {
  e.preventDefault();
  try {
    const blogUrl = validateBlogUrl(blogUrlInput.value.trim());
    chrome.tabs.create({ url: `${blogUrl}/ghost/#/settings/integrations` });
  } catch (err) {
    showStatus(t('errEnterBlogUrl'), 'error');
  }
}

// Event handlers
form.addEventListener('submit', saveSettings);
testBtn.addEventListener('click', testConnection);
openIntegrationsLink.addEventListener('click', openIntegrations);

languageSelect.addEventListener('change', async () => {
  const language = languageSelect.value;
  await chrome.storage.local.set({ language: language || null });
  showStatus(t('msgLanguageChanged'), 'success');
});

// AI Settings event listeners
modelFilterSelect.addEventListener('change', () => {
  loadModels(modelFilterSelect.value);
});

openrouterKeyInput.addEventListener('change', () => {
  if (modelFilterSelect.value !== 'recommended') {
    loadModels(modelFilterSelect.value);
  }
});

// Load settings on page open
loadSettings();
