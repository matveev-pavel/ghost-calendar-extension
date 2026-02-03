// i18n helper functions

/**
 * Get translated message
 * @param {string} key - Message key
 * @param {string|string[]} [substitutions] - Optional substitutions
 * @returns {string} Translated message or key if not found
 */
function t(key, substitutions) {
  const message = chrome.i18n.getMessage(key, substitutions);
  return message || key;
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
 * @returns {Promise<string>} Locale code
 */
async function getCurrentLocale() {
  const { language } = await chrome.storage.local.get('language');
  if (language) {
    // Convert Chrome locale format to BCP 47
    return language.replace('_', '-');
  }
  return chrome.i18n.getUILanguage().replace('_', '-');
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
