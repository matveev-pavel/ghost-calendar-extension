// i18n helper functions with dynamic language switching

// Loaded messages storage
let messages = {};
let currentLocale = 'en';

// Supported locales
const SUPPORTED_LOCALES = ['en', 'es', 'zh_CN', 'pt_BR', 'ru', 'de', 'fr', 'ja', 'ko', 'it'];

/**
 * Initialize i18n - must be called before using t() or applyTranslations()
 * @returns {Promise<void>}
 */
async function initI18n() {
  // Get user's language preference or browser language
  const { language } = await chrome.storage.local.get('language');

  if (language && SUPPORTED_LOCALES.includes(language)) {
    currentLocale = language;
  } else {
    // Use browser language, fallback to 'en'
    const browserLang = chrome.i18n.getUILanguage().replace('-', '_');
    if (SUPPORTED_LOCALES.includes(browserLang)) {
      currentLocale = browserLang;
    } else {
      // Try base language (e.g., 'zh' from 'zh_TW')
      const baseLang = browserLang.split('_')[0];
      const match = SUPPORTED_LOCALES.find(l => l.startsWith(baseLang));
      currentLocale = match || 'en';
    }
  }

  // Load messages for current locale
  await loadMessages(currentLocale);

  // Load English as fallback if not already loaded
  if (currentLocale !== 'en') {
    await loadMessages('en', true);
  }
}

/**
 * Load messages for a specific locale
 * @param {string} locale
 * @param {boolean} asFallback - if true, store as fallback messages
 */
async function loadMessages(locale, asFallback = false) {
  try {
    const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${locale} messages`);
    }
    const data = await response.json();

    if (asFallback) {
      // Merge as fallback (don't overwrite existing)
      for (const key in data) {
        if (!messages[key]) {
          messages[key] = data[key];
        }
      }
    } else {
      messages = data;
    }
  } catch (e) {
    console.warn(`Failed to load messages for locale ${locale}:`, e);
    // If loading fails and not English, try loading English
    if (locale !== 'en' && !asFallback) {
      await loadMessages('en');
    }
  }
}

/**
 * Get translated message
 * @param {string} key - Message key
 * @param {string|string[]} [substitutions] - Optional substitutions
 * @returns {string} Translated message or key if not found
 */
function t(key, substitutions) {
  const entry = messages[key];
  if (!entry || !entry.message) {
    return key;
  }

  let message = entry.message;

  // Handle substitutions
  if (substitutions) {
    const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
    subs.forEach((sub, index) => {
      // Replace $1, $2, etc. and also $PLACEHOLDER$ format
      message = message.replace(new RegExp(`\\$${index + 1}\\$?`, 'g'), sub);
      message = message.replace(new RegExp(`\\$[A-Z_]+\\$`, 'g'), sub);
    });
  }

  return message;
}

/**
 * Apply translations to all elements with data-i18n attributes
 */
function applyTranslations() {
  // Text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const translated = t(key);
    if (translated !== key) {
      el.textContent = translated;
    }
  });

  // Placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    const translated = t(key);
    if (translated !== key) {
      el.placeholder = translated;
    }
  });

  // Titles
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    const translated = t(key);
    if (translated !== key) {
      el.title = translated;
    }
  });

  // Document title
  const titleEl = document.querySelector('title[data-i18n]');
  if (titleEl) {
    const key = titleEl.dataset.i18n;
    const translated = t(key);
    if (translated !== key) {
      document.title = translated;
    }
  }
}

/**
 * Get current locale for Intl.DateTimeFormat
 * @returns {string} Locale code in BCP 47 format
 */
function getCurrentLocale() {
  return currentLocale.replace('_', '-');
}

/**
 * Get month name for a date
 * @param {Date} date
 * @param {string} locale
 * @returns {string}
 */
function getMonthName(date, locale) {
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(date);
}

/**
 * Get short day name
 * @param {Date} date
 * @param {string} locale
 * @returns {string}
 */
function getDayName(date, locale) {
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
}

/**
 * Format date for display
 * @param {Date} date
 * @param {string} locale
 * @returns {string}
 */
function formatDateLong(date, locale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(date);
}

/**
 * Format time for display
 * @param {Date} date
 * @param {string} locale
 * @returns {string}
 */
function formatTimeLocalized(date, locale) {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}
