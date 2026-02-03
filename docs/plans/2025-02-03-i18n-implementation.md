# i18n Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multi-language support (10 languages) to Ghost Calendar Chrome extension using Chrome i18n API.

**Architecture:** Chrome native i18n API with `_locales/` folder structure. Helper module `lib/i18n.js` for applying translations. Intl.DateTimeFormat for date localization.

**Tech Stack:** Chrome i18n API, Intl.DateTimeFormat, vanilla JS

---

## Task 1: Create i18n Infrastructure

**Files:**
- Create: `_locales/en/messages.json`
- Modify: `manifest.json`
- Create: `lib/i18n.js`

**Step 1: Create English messages.json with all strings**

Create `_locales/en/messages.json`:

```json
{
  "extName": {
    "message": "Ghost Calendar",
    "description": "Extension name"
  },
  "extDescription": {
    "message": "Calendar for scheduled Ghost posts",
    "description": "Extension description"
  },
  "appTitle": {
    "message": "Ghost Calendar",
    "description": "App title in header"
  },
  "btnList": {
    "message": "List",
    "description": "List view button title"
  },
  "btnCalendar": {
    "message": "Calendar",
    "description": "Calendar view button title"
  },
  "btnSelectMultiple": {
    "message": "Select multiple posts",
    "description": "Selection mode button title"
  },
  "btnManageTags": {
    "message": "Manage tags",
    "description": "Open tags page button title"
  },
  "btnFilterByTags": {
    "message": "Filter by tags",
    "description": "Filter button title"
  },
  "btnFeedback": {
    "message": "Feedback",
    "description": "Feedback button title"
  },
  "btnSettings": {
    "message": "Settings",
    "description": "Settings button title"
  },
  "filterMatchAny": {
    "message": "Any",
    "description": "Match any tag filter mode"
  },
  "filterMatchAll": {
    "message": "All",
    "description": "Match all tags filter mode"
  },
  "filterMatchAnyTitle": {
    "message": "Match any tag",
    "description": "Match any tag filter mode tooltip"
  },
  "filterMatchAllTitle": {
    "message": "Match all tags",
    "description": "Match all tags filter mode tooltip"
  },
  "filterClear": {
    "message": "Clear",
    "description": "Clear filter button"
  },
  "filterAddTag": {
    "message": "Add tag filter",
    "description": "Add tag to filter button title"
  },
  "filterSearchPlaceholder": {
    "message": "Search tags...",
    "description": "Filter search input placeholder"
  },
  "filterNoResults": {
    "message": "No tags found",
    "description": "No tags found in filter dropdown"
  },
  "selectionPostsSelected": {
    "message": "$COUNT$ posts selected",
    "description": "Selection bar counter",
    "placeholders": {
      "count": {
        "content": "$1",
        "example": "5"
      }
    }
  },
  "selectionAddTag": {
    "message": "Tag",
    "description": "Add tag button in selection bar"
  },
  "selectionRemoveTag": {
    "message": "Tag",
    "description": "Remove tag button in selection bar"
  },
  "selectionCancel": {
    "message": "Cancel",
    "description": "Cancel selection button"
  },
  "loadingPosts": {
    "message": "Loading posts...",
    "description": "Loading posts message"
  },
  "loadingError": {
    "message": "Loading error",
    "description": "Generic loading error"
  },
  "btnRetry": {
    "message": "Retry",
    "description": "Retry button"
  },
  "emptyNoPosts": {
    "message": "No scheduled posts",
    "description": "Empty state message"
  },
  "modalAddTag": {
    "message": "Add Tag",
    "description": "Add tag modal title"
  },
  "modalRemoveTag": {
    "message": "Remove Tag",
    "description": "Remove tag modal title"
  },
  "modalSearchPlaceholder": {
    "message": "Search or create tag...",
    "description": "Bulk tag modal search placeholder"
  },
  "tagPlaceholder": {
    "message": "tag...",
    "description": "Tag input placeholder"
  },
  "addTagTitle": {
    "message": "Add tag",
    "description": "Add tag button title"
  },
  "statusScheduled": {
    "message": "scheduled",
    "description": "Scheduled post status"
  },
  "statusPublished": {
    "message": "published",
    "description": "Published post status"
  },
  "dateToday": {
    "message": "Today",
    "description": "Today date label"
  },
  "dateYesterday": {
    "message": "Yesterday",
    "description": "Yesterday date label"
  },
  "dateTomorrow": {
    "message": "Tomorrow",
    "description": "Tomorrow date label"
  },
  "calendarToday": {
    "message": "(today)",
    "description": "Today label in calendar"
  },
  "calendarYesterday": {
    "message": "(yesterday)",
    "description": "Yesterday label in calendar"
  },
  "alertSelectPost": {
    "message": "Please select at least one post",
    "description": "Alert when no posts selected"
  },
  "alertErrorAddingTag": {
    "message": "Error adding tag: $ERROR$",
    "description": "Error adding tag alert",
    "placeholders": {
      "error": {
        "content": "$1",
        "example": "Network error"
      }
    }
  },
  "alertErrorRemovingTag": {
    "message": "Error removing tag: $ERROR$",
    "description": "Error removing tag alert",
    "placeholders": {
      "error": {
        "content": "$1",
        "example": "Network error"
      }
    }
  },
  "bulkNoTags": {
    "message": "No tags available",
    "description": "No tags in bulk tag modal"
  },
  "bulkCreateNew": {
    "message": "+ Create \"$NAME$\"",
    "description": "Create new tag option",
    "placeholders": {
      "name": {
        "content": "$1",
        "example": "my-tag"
      }
    }
  },
  "optionsTitle": {
    "message": "Settings",
    "description": "Options page title"
  },
  "optionsSubtitle": {
    "message": "Configure connection to your Ghost blog",
    "description": "Options page subtitle"
  },
  "labelLanguage": {
    "message": "Language",
    "description": "Language selector label"
  },
  "languageAuto": {
    "message": "Auto (Browser)",
    "description": "Auto-detect language option"
  },
  "labelBlogUrl": {
    "message": "Blog URL",
    "description": "Blog URL field label"
  },
  "placeholderBlogUrl": {
    "message": "https://blog.example.com",
    "description": "Blog URL placeholder"
  },
  "hintBlogUrl": {
    "message": "Full URL of your Ghost blog",
    "description": "Blog URL hint"
  },
  "labelApiKey": {
    "message": "Admin API Key",
    "description": "API key field label"
  },
  "placeholderApiKey": {
    "message": "xxxxxxxxxxxxxxxxxxxxxxxx:yyyyyyyyyyyyyyyyyyyyyyyy",
    "description": "API key placeholder"
  },
  "hintApiKey": {
    "message": "Find in Ghost Admin: Settings → Integrations →",
    "description": "API key hint"
  },
  "hintApiKeyLink": {
    "message": "Add custom integration",
    "description": "API key hint link text"
  },
  "btnTest": {
    "message": "Test",
    "description": "Test connection button"
  },
  "btnSave": {
    "message": "Save",
    "description": "Save button"
  },
  "msgTesting": {
    "message": "Testing connection...",
    "description": "Testing connection status"
  },
  "msgConnected": {
    "message": "Connected! Posts found: $COUNT$",
    "description": "Connection success message",
    "placeholders": {
      "count": {
        "content": "$1",
        "example": "42"
      }
    }
  },
  "msgSaving": {
    "message": "Saving...",
    "description": "Saving status"
  },
  "msgSaved": {
    "message": "Settings saved!",
    "description": "Settings saved message"
  },
  "msgSaveError": {
    "message": "Save error: $ERROR$",
    "description": "Save error message",
    "placeholders": {
      "error": {
        "content": "$1",
        "example": "Network error"
      }
    }
  },
  "msgError": {
    "message": "Error: $ERROR$",
    "description": "Generic error message",
    "placeholders": {
      "error": {
        "content": "$1",
        "example": "Network error"
      }
    }
  },
  "errFillAllFields": {
    "message": "Please fill in all fields",
    "description": "Fill all fields error"
  },
  "errBlogUrlRequired": {
    "message": "Blog URL is not specified",
    "description": "Blog URL required error"
  },
  "errHttpsRequired": {
    "message": "URL must use HTTPS for secure connection",
    "description": "HTTPS required error"
  },
  "errInvalidUrl": {
    "message": "Invalid blog URL format",
    "description": "Invalid URL error"
  },
  "errInvalidApiKey": {
    "message": "Invalid API key format",
    "description": "Invalid API key error"
  },
  "errInvalidSecret": {
    "message": "Invalid secret format. Secret must be in hex format",
    "description": "Invalid secret error"
  },
  "errInvalidSecretLength": {
    "message": "Invalid secret length. Length must be even",
    "description": "Invalid secret length error"
  },
  "errEnterBlogUrl": {
    "message": "Please enter blog URL first",
    "description": "Enter blog URL first error"
  },
  "msgLanguageChanged": {
    "message": "Language changed. Reload extension to apply.",
    "description": "Language change message"
  },
  "tagsTitle": {
    "message": "Tag Management",
    "description": "Tags page title"
  },
  "btnBackToCalendar": {
    "message": "Back to calendar",
    "description": "Back button title"
  },
  "btnNewTag": {
    "message": "New Tag",
    "description": "New tag button"
  },
  "tabPublicTags": {
    "message": "Public Tags",
    "description": "Public tags tab"
  },
  "tabInternalTags": {
    "message": "Internal Tags (#)",
    "description": "Internal tags tab"
  },
  "searchTagsPlaceholder": {
    "message": "Search tags...",
    "description": "Search tags placeholder"
  },
  "selectAll": {
    "message": "Select all",
    "description": "Select all checkbox label"
  },
  "selectedCount": {
    "message": "$COUNT$ selected",
    "description": "Selected items count",
    "placeholders": {
      "count": {
        "content": "$1",
        "example": "5"
      }
    }
  },
  "btnDeleteSelected": {
    "message": "Delete Selected",
    "description": "Delete selected button"
  },
  "loadingTags": {
    "message": "Loading tags...",
    "description": "Loading tags message"
  },
  "emptyNoTags": {
    "message": "No tags found",
    "description": "No tags empty state"
  },
  "btnCreateFirstTag": {
    "message": "Create First Tag",
    "description": "Create first tag button"
  },
  "modalNewTag": {
    "message": "New Tag",
    "description": "New tag modal title"
  },
  "modalEditTag": {
    "message": "Edit Tag",
    "description": "Edit tag modal title"
  },
  "labelTagName": {
    "message": "Name",
    "description": "Tag name label"
  },
  "placeholderTagName": {
    "message": "Tag name",
    "description": "Tag name placeholder"
  },
  "hintTagName": {
    "message": "Internal tags start with # (e.g., #featured)",
    "description": "Tag name hint"
  },
  "labelTagSlug": {
    "message": "Slug",
    "description": "Tag slug label"
  },
  "placeholderTagSlug": {
    "message": "tag-slug",
    "description": "Tag slug placeholder"
  },
  "hintTagSlug": {
    "message": "URL-friendly version (auto-generated)",
    "description": "Tag slug hint"
  },
  "labelTagDescription": {
    "message": "Description",
    "description": "Tag description label"
  },
  "placeholderTagDescription": {
    "message": "Optional description...",
    "description": "Tag description placeholder"
  },
  "btnCancel": {
    "message": "Cancel",
    "description": "Cancel button"
  },
  "modalDeleteTag": {
    "message": "Delete Tag",
    "description": "Delete tag modal title"
  },
  "modalDeleteTags": {
    "message": "Delete Tags",
    "description": "Delete multiple tags modal title"
  },
  "msgDeleteConfirm": {
    "message": "Are you sure you want to delete $NAME$?",
    "description": "Delete confirmation message",
    "placeholders": {
      "name": {
        "content": "$1",
        "example": "my-tag"
      }
    }
  },
  "msgDeleteMultipleConfirm": {
    "message": "Are you sure you want to delete $COUNT$ tags?",
    "description": "Delete multiple confirmation",
    "placeholders": {
      "count": {
        "content": "$1",
        "example": "5"
      }
    }
  },
  "msgDeleteWarning": {
    "message": "This will remove the tag(s) from all posts.",
    "description": "Delete warning message"
  },
  "btnDelete": {
    "message": "Delete",
    "description": "Delete button"
  },
  "errTagNameRequired": {
    "message": "Tag name is required",
    "description": "Tag name required error"
  },
  "errTagNotCreated": {
    "message": "Tag was not created - empty response from server",
    "description": "Tag creation error"
  },
  "errSavingTag": {
    "message": "Error saving tag: $ERROR$",
    "description": "Tag save error",
    "placeholders": {
      "error": {
        "content": "$1",
        "example": "Network error"
      }
    }
  },
  "errDeletingTag": {
    "message": "Error deleting tag: $ERROR$",
    "description": "Tag delete error",
    "placeholders": {
      "error": {
        "content": "$1",
        "example": "Network error"
      }
    }
  },
  "errDeletingTags": {
    "message": "Error deleting tags: $ERROR$",
    "description": "Bulk tag delete error",
    "placeholders": {
      "error": {
        "content": "$1",
        "example": "Network error"
      }
    }
  },
  "msgBulkDeleteResult": {
    "message": "Deleted $DELETED$ tags. Failed to delete $FAILED$ tags.",
    "description": "Bulk delete result message",
    "placeholders": {
      "deleted": {
        "content": "$1",
        "example": "3"
      },
      "failed": {
        "content": "$2",
        "example": "1"
      }
    }
  },
  "tagPostCount": {
    "message": "$COUNT$ posts",
    "description": "Tag post count",
    "placeholders": {
      "count": {
        "content": "$1",
        "example": "5"
      }
    }
  },
  "tagPostCountSingle": {
    "message": "1 post",
    "description": "Single post count"
  },
  "noTagsMatching": {
    "message": "No tags matching \"$QUERY$\"",
    "description": "No tags matching search",
    "placeholders": {
      "query": {
        "content": "$1",
        "example": "test"
      }
    }
  },
  "noPublicTags": {
    "message": "No public tags found",
    "description": "No public tags message"
  },
  "noInternalTags": {
    "message": "No internal tags found",
    "description": "No internal tags message"
  },
  "btnEdit": {
    "message": "Edit",
    "description": "Edit button title"
  }
}
```

**Step 2: Update manifest.json**

Add `default_locale` and update name/description:

```json
{
  "manifest_version": 3,
  "default_locale": "en",
  "name": "__MSG_extName__",
  "description": "__MSG_extDescription__",
  ...
}
```

**Step 3: Create lib/i18n.js helper**

```javascript
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
function formatTime(date, locale) {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}
```

**Step 4: Commit**

```bash
git add _locales/en/messages.json lib/i18n.js manifest.json
git commit -m "feat: add i18n infrastructure with English messages"
```

---

## Task 2: Localize Side Panel HTML

**Files:**
- Modify: `sidepanel/sidepanel.html`
- Modify: `sidepanel/sidepanel.js`

**Step 1: Update sidepanel.html with data-i18n attributes**

Replace hardcoded text with data-i18n attributes and add i18n.js script.

Key changes:
- `<title>Ghost Calendar</title>` → `<title data-i18n="appTitle">Ghost Calendar</title>`
- `<h1>Ghost Calendar</h1>` → `<h1 data-i18n="appTitle">Ghost Calendar</h1>`
- All button titles: add `data-i18n-title="key"`
- Filter mode buttons: add `data-i18n="filterMatchAny"` etc.
- Loading/empty states: add `data-i18n="loadingPosts"` etc.
- Modal title: add `data-i18n="modalAddTag"`
- Add `<script src="../lib/i18n.js"></script>` before sidepanel.js

**Step 2: Update sidepanel.js**

1. Remove hardcoded `monthNames` array
2. Add locale variable and initialize it
3. Update `renderCalendar()` to use `getMonthName()`
4. Update `formatDateHeader()` to use `t()` and `formatDateLong()`
5. Update `formatTime()` to use locale
6. Update dynamic strings (status texts, alerts) to use `t()`
7. Call `applyTranslations()` in `init()`

**Step 3: Commit**

```bash
git add sidepanel/sidepanel.html sidepanel/sidepanel.js
git commit -m "feat: localize side panel"
```

---

## Task 3: Localize Options Page

**Files:**
- Modify: `options/options.html`
- Modify: `options/options.js`

**Step 1: Update options.html**

Add data-i18n attributes and language selector:
- Add `<script src="../lib/i18n.js"></script>`
- Title, h1, subtitle with data-i18n
- Form labels with data-i18n
- Placeholders with data-i18n-placeholder
- Hints with data-i18n
- Buttons with data-i18n
- Add language selector as first form group

**Step 2: Update options.js**

1. Add language selector handling
2. Load/save language preference
3. Replace hardcoded error/status messages with `t()`
4. Call `applyTranslations()` on load
5. Show reload message when language changes

**Step 3: Commit**

```bash
git add options/options.html options/options.js
git commit -m "feat: localize options page with language selector"
```

---

## Task 4: Localize Tags Page

**Files:**
- Modify: `tags/tags.html`
- Modify: `tags/tags.js`

**Step 1: Update tags.html**

Add data-i18n attributes:
- Add `<script src="../lib/i18n.js"></script>`
- Title, header, buttons
- Tab labels
- Search placeholder
- Modal content
- Loading/error/empty states

**Step 2: Update tags.js**

1. Replace hardcoded strings with `t()`
2. Call `applyTranslations()` in `init()`
3. Update dynamic modal titles
4. Update alert messages

**Step 3: Commit**

```bash
git add tags/tags.html tags/tags.js
git commit -m "feat: localize tags page"
```

---

## Task 5: Create Translations for All Languages

**Files:**
- Create: `_locales/es/messages.json`
- Create: `_locales/zh_CN/messages.json`
- Create: `_locales/pt_BR/messages.json`
- Create: `_locales/ru/messages.json`
- Create: `_locales/de/messages.json`
- Create: `_locales/fr/messages.json`
- Create: `_locales/ja/messages.json`
- Create: `_locales/ko/messages.json`
- Create: `_locales/it/messages.json`

**Step 1: Create Spanish (es) messages.json**

Translate all messages to Spanish.

**Step 2: Create Chinese Simplified (zh_CN) messages.json**

Translate all messages to Chinese.

**Step 3: Create Portuguese Brazil (pt_BR) messages.json**

Translate all messages to Portuguese.

**Step 4: Create Russian (ru) messages.json**

Translate all messages to Russian.

**Step 5: Create German (de) messages.json**

Translate all messages to German.

**Step 6: Create French (fr) messages.json**

Translate all messages to French.

**Step 7: Create Japanese (ja) messages.json**

Translate all messages to Japanese.

**Step 8: Create Korean (ko) messages.json**

Translate all messages to Korean.

**Step 9: Create Italian (it) messages.json**

Translate all messages to Italian.

**Step 10: Commit all translations**

```bash
git add _locales/
git commit -m "feat: add translations for 9 languages"
```

---

## Task 6: Final Testing and Cleanup

**Step 1: Test extension in different locales**

1. Change Chrome language settings
2. Reload extension
3. Verify all strings are translated
4. Test language selector in Options

**Step 2: Verify fallback to English**

1. Set unsupported locale
2. Verify English is displayed

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete i18n implementation"
```
