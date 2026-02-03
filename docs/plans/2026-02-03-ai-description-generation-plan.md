# AI Description Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add AI-powered SEO description generation for tags using OpenRouter API with streaming support.

**Architecture:** New OpenRouter client module (`lib/openrouter.js`) handles API communication with SSE streaming. Settings stored in `chrome.storage.local`. Tag manager UI extended with generate button and character counter.

**Tech Stack:** Vanilla JS, OpenRouter API, Server-Sent Events (SSE), Chrome Storage API

---

## Task 1: Create OpenRouter API Client

**Files:**
- Create: `lib/openrouter.js`

**Step 1: Create the OpenRouter client module**

```javascript
/**
 * OpenRouter API client with streaming support
 */

const RECOMMENDED_MODELS = [
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (free)' },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (free)' },
  { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (free)' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (free)' }
];

const MODELS_CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours

class OpenRouterAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://openrouter.ai/api/v1';
  }

  /**
   * Fetch available models from OpenRouter API
   */
  async fetchModels() {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  /**
   * Get models with caching and filtering
   * @param {string} filter - 'recommended', 'free', or 'all'
   */
  async getModels(filter = 'recommended') {
    if (filter === 'recommended') {
      return RECOMMENDED_MODELS;
    }

    // Check cache
    const { openrouterModelsCache, openrouterModelsCacheTime } =
      await chrome.storage.local.get(['openrouterModelsCache', 'openrouterModelsCacheTime']);

    const now = Date.now();
    let models;

    if (openrouterModelsCache && openrouterModelsCacheTime &&
        (now - openrouterModelsCacheTime) < MODELS_CACHE_TTL) {
      models = openrouterModelsCache;
    } else {
      models = await this.fetchModels();
      await chrome.storage.local.set({
        openrouterModelsCache: models,
        openrouterModelsCacheTime: now
      });
    }

    if (filter === 'free') {
      models = models.filter(m =>
        m.pricing?.prompt === '0' && m.pricing?.completion === '0'
      );
    }

    return models.map(m => ({ id: m.id, name: m.name }));
  }

  /**
   * Generate description with streaming
   * @param {Object} options - Generation options
   * @param {string} options.model - Model ID
   * @param {string} options.tagName - Tag name
   * @param {Array} options.posts - Array of {title, description}
   * @param {string} options.language - Target language
   * @param {string} options.customPrompt - Optional custom instructions
   * @param {Function} options.onChunk - Callback for each text chunk
   * @param {AbortSignal} options.signal - Abort signal for cancellation
   */
  async generateDescription({ model, tagName, posts, language, customPrompt, onChunk, signal }) {
    const systemPrompt = this.buildSystemPrompt(tagName, posts, language, customPrompt);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/ghost-calendar-extension',
        'X-Title': 'Ghost Calendar Extension'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate the description.' }
        ],
        stream: true,
        max_tokens: 300
      }),
      signal
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = error.error?.message || `HTTP ${response.status}`;
      throw new Error(message);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              onChunk(content, fullText);
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }

    return fullText;
  }

  buildSystemPrompt(tagName, posts, language, customPrompt) {
    const postsContext = posts
      .map(p => `- ${p.title}${p.description ? ': ' + p.description : ''}`)
      .join('\n');

    let prompt = `You are an SEO specialist writing tag descriptions for a blog.

Task: Write a concise description for the tag "${tagName}".

Requirements:
- Maximum 500 characters
- Language: ${language}
- SEO-optimized: include relevant keywords naturally
- Describe what readers will find in this category
- Do not use quotes around the text
- Do not include the tag name at the very beginning`;

    if (customPrompt) {
      prompt += `\n\nAdditional instructions: ${customPrompt}`;
    }

    prompt += `\n\nContext - recent posts in this tag:\n${postsContext}`;

    return prompt;
  }
}

/**
 * Create OpenRouter API instance from storage
 */
async function createOpenRouterFromStorage() {
  const { openrouterApiKey } = await chrome.storage.local.get(['openrouterApiKey']);

  if (!openrouterApiKey) {
    return null;
  }

  return new OpenRouterAPI(openrouterApiKey);
}

/**
 * Get OpenRouter settings from storage
 */
async function getOpenRouterSettings() {
  const settings = await chrome.storage.local.get([
    'openrouterApiKey',
    'openrouterModel',
    'openrouterLanguage',
    'openrouterCustomPrompt'
  ]);

  return {
    apiKey: settings.openrouterApiKey || '',
    model: settings.openrouterModel || 'google/gemini-2.0-flash-exp:free',
    language: settings.openrouterLanguage || 'English',
    customPrompt: settings.openrouterCustomPrompt || ''
  };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OpenRouterAPI, createOpenRouterFromStorage, getOpenRouterSettings, RECOMMENDED_MODELS };
}
```

**Step 2: Verify file created correctly**

Run: `ls -la lib/openrouter.js`
Expected: File exists with correct permissions

**Step 3: Commit**

```bash
git add lib/openrouter.js
git commit -m "feat: add OpenRouter API client with streaming support"
```

---

## Task 2: Add AI Settings to Options Page HTML

**Files:**
- Modify: `options/options.html:230-237` (before closing `</form>`)

**Step 1: Add AI Settings section to options.html**

Insert after the API key form-group (line 229) and before the buttons div (line 232):

```html
      <!-- AI Settings Section -->
      <div class="section-divider"></div>
      <h2 class="section-title" data-i18n="aiSettingsTitle">AI Settings (OpenRouter)</h2>

      <div class="form-group">
        <label for="openrouter-key" data-i18n="labelOpenRouterKey">OpenRouter API Key</label>
        <input
          type="password"
          id="openrouter-key"
          data-i18n-placeholder="placeholderOpenRouterKey"
          placeholder="sk-or-v1-..."
        >
        <p class="hint">
          <span data-i18n="hintOpenRouterKey">Get your key at</span>
          <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a>
        </p>
      </div>

      <div class="form-row">
        <div class="form-group half">
          <label for="model-filter" data-i18n="labelModelFilter">Model Filter</label>
          <select id="model-filter">
            <option value="recommended" data-i18n="filterRecommended">Recommended</option>
            <option value="free" data-i18n="filterFree">Free</option>
            <option value="all" data-i18n="filterAll">All</option>
          </select>
        </div>
        <div class="form-group half">
          <label for="openrouter-model" data-i18n="labelModel">Model</label>
          <select id="openrouter-model">
            <option value="">Loading...</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label for="generation-language" data-i18n="labelGenerationLanguage">Generation Language</label>
        <select id="generation-language">
          <option value="English">English</option>
          <option value="Spanish">Espa&#241;ol</option>
          <option value="Portuguese">Portugu&#234;s</option>
          <option value="Russian">&#1056;&#1091;&#1089;&#1089;&#1082;&#1080;&#1081;</option>
          <option value="German">Deutsch</option>
          <option value="French">Fran&#231;ais</option>
          <option value="Chinese">&#20013;&#25991;</option>
          <option value="Japanese">&#26085;&#26412;&#35486;</option>
          <option value="Korean">&#54620;&#44397;&#50612;</option>
          <option value="Italian">Italiano</option>
        </select>
      </div>

      <div class="form-group">
        <label for="custom-prompt" data-i18n="labelCustomPrompt">Custom Prompt (optional)</label>
        <textarea
          id="custom-prompt"
          rows="2"
          data-i18n-placeholder="placeholderCustomPrompt"
          placeholder="Additional instructions for AI generation..."
        ></textarea>
        <p class="hint" data-i18n="hintCustomPrompt">Adjust tone and style of generated descriptions</p>
      </div>
```

**Step 2: Add CSS for new elements**

Add inside `<style>` section:

```css
    .section-divider {
      height: 1px;
      background: #e6e6e6;
      margin: 28px 0;
    }

    .section-title {
      color: #15171a;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 20px;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .form-group.half {
      flex: 1;
    }

    textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e6e6e6;
      border-radius: 4px;
      font-size: 14px;
      font-family: inherit;
      color: #15171a;
      resize: vertical;
      transition: border-color 0.15s;
    }

    textarea:focus {
      outline: none;
      border-color: #a0a0a0;
    }
```

**Step 3: Add script reference**

Add before `options.js` script:

```html
  <script src="../lib/openrouter.js"></script>
```

**Step 4: Commit**

```bash
git add options/options.html
git commit -m "feat: add AI settings section to options page"
```

---

## Task 3: Add AI Settings Logic to Options JS

**Files:**
- Modify: `options/options.js`

**Step 1: Add DOM references at top of file (after line 7)**

```javascript
const openrouterKeyInput = document.getElementById('openrouter-key');
const modelFilterSelect = document.getElementById('model-filter');
const openrouterModelSelect = document.getElementById('openrouter-model');
const generationLanguageSelect = document.getElementById('generation-language');
const customPromptTextarea = document.getElementById('custom-prompt');
```

**Step 2: Add model loading function (after loadSettings function)**

```javascript
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
```

**Step 3: Update loadSettings to include AI settings**

Replace the loadSettings function:

```javascript
// Load saved settings
async function loadSettings() {
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
```

**Step 4: Update saveSettings to include AI settings**

In the saveSettings function, after `await chrome.storage.local.set({ blogUrl, apiKey });` add:

```javascript
    // Save AI settings
    await chrome.storage.local.set({
      openrouterApiKey: openrouterKeyInput.value.trim(),
      openrouterModel: openrouterModelSelect.value,
      openrouterModelFilter: modelFilterSelect.value,
      openrouterLanguage: generationLanguageSelect.value,
      openrouterCustomPrompt: customPromptTextarea.value.trim()
    });
```

**Step 5: Add event listeners for AI settings (after line 210)**

```javascript
// AI Settings event listeners
modelFilterSelect.addEventListener('change', () => {
  loadModels(modelFilterSelect.value);
});

openrouterKeyInput.addEventListener('change', () => {
  if (modelFilterSelect.value !== 'recommended') {
    loadModels(modelFilterSelect.value);
  }
});
```

**Step 6: Commit**

```bash
git add options/options.js
git commit -m "feat: add AI settings logic to options page"
```

---

## Task 4: Add Localization Strings

**Files:**
- Modify: `_locales/en/messages.json`
- Modify: `_locales/ru/messages.json`

**Step 1: Add English strings to _locales/en/messages.json**

Add before the closing `}`:

```json
  "aiSettingsTitle": {
    "message": "AI Settings (OpenRouter)",
    "description": "AI settings section title"
  },
  "labelOpenRouterKey": {
    "message": "OpenRouter API Key",
    "description": "OpenRouter API key label"
  },
  "placeholderOpenRouterKey": {
    "message": "sk-or-v1-...",
    "description": "OpenRouter API key placeholder"
  },
  "hintOpenRouterKey": {
    "message": "Get your key at",
    "description": "OpenRouter key hint"
  },
  "labelModelFilter": {
    "message": "Model Filter",
    "description": "Model filter label"
  },
  "filterRecommended": {
    "message": "Recommended",
    "description": "Recommended models filter"
  },
  "filterFree": {
    "message": "Free",
    "description": "Free models filter"
  },
  "filterAll": {
    "message": "All",
    "description": "All models filter"
  },
  "labelModel": {
    "message": "Model",
    "description": "Model select label"
  },
  "labelGenerationLanguage": {
    "message": "Generation Language",
    "description": "Generation language label"
  },
  "labelCustomPrompt": {
    "message": "Custom Prompt (optional)",
    "description": "Custom prompt label"
  },
  "placeholderCustomPrompt": {
    "message": "Additional instructions for AI generation...",
    "description": "Custom prompt placeholder"
  },
  "hintCustomPrompt": {
    "message": "Adjust tone and style of generated descriptions",
    "description": "Custom prompt hint"
  },
  "errOpenRouterKeyRequired": {
    "message": "OpenRouter API key required for this filter",
    "description": "OpenRouter key required error"
  },
  "aiGenerateDescription": {
    "message": "Generate description with AI",
    "description": "Generate button tooltip"
  },
  "aiMinPostsRequired": {
    "message": "Minimum 2 posts required for AI generation",
    "description": "Minimum posts hint"
  },
  "aiReplaceConfirm": {
    "message": "Replace existing description?",
    "description": "Replace confirmation title"
  },
  "aiReplaceMessage": {
    "message": "The current description will be replaced with AI-generated text.",
    "description": "Replace confirmation message"
  },
  "btnReplace": {
    "message": "Replace",
    "description": "Replace button"
  },
  "aiGenerating": {
    "message": "Generating...",
    "description": "Generating status"
  },
  "errApiKeyNotConfigured": {
    "message": "API key not configured",
    "description": "API key not configured error"
  },
  "errGenerationFailed": {
    "message": "Generation failed: $ERROR$",
    "description": "Generation error",
    "placeholders": {
      "error": {
        "content": "$1",
        "example": "Network error"
      }
    }
  },
  "aiGenerationInterrupted": {
    "message": "Generation interrupted",
    "description": "Generation interrupted message"
  },
  "btnOpenSettings": {
    "message": "Open Settings",
    "description": "Open settings button"
  },
  "charCounter": {
    "message": "$CURRENT$ / $MAX$",
    "description": "Character counter",
    "placeholders": {
      "current": {
        "content": "$1",
        "example": "342"
      },
      "max": {
        "content": "$2",
        "example": "500"
      }
    }
  }
```

**Step 2: Add Russian strings to _locales/ru/messages.json**

Add same keys with Russian translations.

**Step 3: Commit**

```bash
git add _locales/
git commit -m "feat: add localization for AI settings"
```

---

## Task 5: Add Ghost API Method for Posts by Tag

**Files:**
- Modify: `lib/api.js`

**Step 1: Add getPostsByTag method to GhostAPI class (after getTagsWithCount method)**

```javascript
  /**
   * Get posts by tag ID (for AI description generation)
   * @param {string} tagId - Tag ID
   * @param {Object} options - Options
   * @param {number} options.limit - Max posts to return (default 10)
   */
  async getPostsByTag(tagId, { limit = 10 } = {}) {
    const filter = `tag:${tagId}`;
    const data = await this.request(
      `/posts/?filter=${encodeURIComponent(filter)}&order=published_at%20desc&fields=id,title,meta_description,custom_excerpt&limit=${limit}`
    );
    return data.posts || [];
  }
```

**Step 2: Commit**

```bash
git add lib/api.js
git commit -m "feat: add getPostsByTag method to Ghost API"
```

---

## Task 6: Add UI Elements to Tag Manager HTML

**Files:**
- Modify: `tags/tags.html`

**Step 1: Update Description form-group in modal (lines 101-104)**

Replace the description form-group:

```html
          <div class="form-group">
            <div class="label-row">
              <label for="tag-description" data-i18n="labelTagDescription">Description</label>
              <button type="button" class="ai-generate-btn" id="ai-generate-btn" data-i18n-title="aiGenerateDescription" title="Generate description with AI" hidden>
                ✨
              </button>
            </div>
            <textarea id="tag-description" rows="3" data-i18n-placeholder="placeholderTagDescription" placeholder="Optional description..."></textarea>
            <div class="description-footer">
              <span class="ai-hint" id="ai-hint" hidden data-i18n="aiMinPostsRequired">Minimum 2 posts required for AI generation</span>
              <span class="char-counter" id="char-counter">0 / 500</span>
            </div>
          </div>
```

**Step 2: Add Replace Confirmation Modal (after delete modal, before closing container div)**

```html
    <!-- Replace Description Confirmation Modal -->
    <div class="modal-overlay" id="replace-modal" hidden>
      <div class="modal modal-small">
        <div class="modal-header">
          <h2 data-i18n="aiReplaceConfirm">Replace existing description?</h2>
          <button class="modal-close" id="replace-modal-close">×</button>
        </div>
        <div class="modal-body">
          <p data-i18n="aiReplaceMessage">The current description will be replaced with AI-generated text.</p>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="replace-cancel" data-i18n="btnCancel">Cancel</button>
          <button class="primary-btn" id="replace-confirm" data-i18n="btnReplace">Replace</button>
        </div>
      </div>
    </div>

    <!-- Toast notification -->
    <div class="toast" id="toast" hidden></div>
```

**Step 3: Add script reference before tags.js**

```html
  <script src="../lib/openrouter.js"></script>
```

**Step 4: Commit**

```bash
git add tags/tags.html
git commit -m "feat: add AI generation UI elements to tag manager"
```

---

## Task 7: Add CSS for AI Generation UI

**Files:**
- Modify: `tags/tags.css`

**Step 1: Add styles at end of file**

```css
/* AI Generate Button */
.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.label-row label {
  margin-bottom: 0;
}

.ai-generate-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: #fff;
  border: 1px solid #e6e6e6;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.ai-generate-btn:hover {
  border-color: #30cf43;
  background: #f0fdf4;
}

.ai-generate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-generate-btn.loading {
  pointer-events: none;
}

.ai-generate-btn .spinner-small {
  width: 14px;
  height: 14px;
  border: 2px solid #e6e6e6;
  border-top-color: #30cf43;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* Description footer */
.description-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
  min-height: 20px;
}

.ai-hint {
  font-size: 12px;
  color: #738a94;
}

.char-counter {
  font-size: 12px;
  color: #a0a0a0;
  margin-left: auto;
}

.char-counter.warning {
  color: #ef4444;
}

/* Toast notification */
.toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #15171a;
  color: white;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 2000;
  max-width: 90%;
}

.toast[hidden] {
  display: none;
}

.toast.error {
  background: #ef4444;
}

.toast-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.toast-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}
```

**Step 2: Commit**

```bash
git add tags/tags.css
git commit -m "feat: add CSS for AI generation UI"
```

---

## Task 8: Add AI Generation Logic to Tag Manager JS

**Files:**
- Modify: `tags/tags.js`

**Step 1: Add state variables at top (after line 9)**

```javascript
let isGenerating = false;
let generateAbortController = null;
```

**Step 2: Add DOM references (after line 17)**

```javascript
const aiGenerateBtn = document.getElementById('ai-generate-btn');
const aiHint = document.getElementById('ai-hint');
const charCounter = document.getElementById('char-counter');
const descriptionTextarea = document.getElementById('tag-description');
const replaceModal = document.getElementById('replace-modal');
const toast = document.getElementById('toast');
```

**Step 3: Add helper functions (after escapeHtml function)**

```javascript
// Show toast notification
function showToast(message, type = 'info', actionBtn = null) {
  toast.className = `toast ${type}`;
  toast.innerHTML = message;

  if (actionBtn) {
    const btn = document.createElement('button');
    btn.className = 'toast-btn';
    btn.textContent = actionBtn.text;
    btn.onclick = actionBtn.onClick;
    toast.appendChild(btn);
  }

  toast.hidden = false;

  setTimeout(() => {
    toast.hidden = true;
  }, 5000);
}

// Update character counter
function updateCharCounter() {
  const length = descriptionTextarea.value.length;
  charCounter.textContent = `${length} / 500`;
  charCounter.classList.toggle('warning', length > 500);
}

// Check if AI generation is available for tag
async function checkAIAvailability(tagId) {
  const settings = await getOpenRouterSettings();
  const tag = tags.find(t => t.id === tagId);
  const postCount = tag?.count?.posts || 0;

  const hasApiKey = !!settings.apiKey;
  const hasEnoughPosts = postCount >= 2;

  aiGenerateBtn.hidden = !hasApiKey || !hasEnoughPosts;
  aiHint.hidden = hasApiKey && hasEnoughPosts;

  if (!hasApiKey) {
    aiHint.textContent = t('errApiKeyNotConfigured');
    aiHint.hidden = false;
  } else if (!hasEnoughPosts) {
    aiHint.textContent = t('aiMinPostsRequired');
    aiHint.hidden = false;
  }
}

// Start AI generation
async function startAIGeneration() {
  if (isGenerating) return;

  const settings = await getOpenRouterSettings();

  if (!settings.apiKey) {
    showToast(t('errApiKeyNotConfigured'), 'error', {
      text: t('btnOpenSettings'),
      onClick: () => chrome.runtime.openOptionsPage()
    });
    return;
  }

  // Check for existing description
  if (descriptionTextarea.value.trim()) {
    replaceModal.hidden = false;
    return;
  }

  await generateDescription();
}

// Generate description with AI
async function generateDescription() {
  if (isGenerating) return;

  isGenerating = true;
  generateAbortController = new AbortController();

  // Update UI
  aiGenerateBtn.innerHTML = '<div class="spinner-small"></div>';
  aiGenerateBtn.classList.add('loading');
  descriptionTextarea.value = '';
  updateCharCounter();

  try {
    const settings = await getOpenRouterSettings();
    const tag = tags.find(t => t.id === editingTagId);

    // Get posts for context
    const posts = await api.getPostsByTag(editingTagId, { limit: 10 });
    const postsContext = posts.map(p => ({
      title: p.title,
      description: p.meta_description || p.custom_excerpt || ''
    }));

    const openrouter = new OpenRouterAPI(settings.apiKey);

    await openrouter.generateDescription({
      model: settings.model,
      tagName: tag.name,
      posts: postsContext,
      language: settings.language,
      customPrompt: settings.customPrompt,
      signal: generateAbortController.signal,
      onChunk: (chunk, fullText) => {
        descriptionTextarea.value = fullText;
        updateCharCounter();
      }
    });

  } catch (error) {
    if (error.name === 'AbortError') {
      showToast(t('aiGenerationInterrupted'), 'info');
    } else {
      console.error('Generation error:', error);
      showToast(t('errGenerationFailed', [error.message]), 'error');
    }
  } finally {
    isGenerating = false;
    generateAbortController = null;
    aiGenerateBtn.innerHTML = '✨';
    aiGenerateBtn.classList.remove('loading');
  }
}

// Abort generation
function abortGeneration() {
  if (generateAbortController) {
    generateAbortController.abort();
  }
}
```

**Step 4: Update openEditModal function to check AI availability**

Add at the end of openEditModal (before the closing brace):

```javascript
  // Check AI availability
  checkAIAvailability(tagId);
  updateCharCounter();
```

**Step 5: Update openCreateModal function**

Add at the end of openCreateModal (before the closing brace):

```javascript
  // Hide AI for new tags (no posts yet)
  aiGenerateBtn.hidden = true;
  aiHint.hidden = true;
  updateCharCounter();
```

**Step 6: Update closeModal to abort generation**

Add at the beginning of closeModal:

```javascript
  abortGeneration();
```

**Step 7: Add event listeners in setupModalListeners (at the end)**

```javascript
  // AI generation
  aiGenerateBtn.addEventListener('click', startAIGeneration);

  // Character counter
  descriptionTextarea.addEventListener('input', updateCharCounter);

  // Replace modal
  document.getElementById('replace-modal-close').addEventListener('click', () => {
    replaceModal.hidden = true;
  });
  document.getElementById('replace-cancel').addEventListener('click', () => {
    replaceModal.hidden = true;
  });
  document.getElementById('replace-confirm').addEventListener('click', async () => {
    replaceModal.hidden = true;
    await generateDescription();
  });
  replaceModal.addEventListener('click', (e) => {
    if (e.target === replaceModal) replaceModal.hidden = true;
  });
```

**Step 8: Commit**

```bash
git add tags/tags.js
git commit -m "feat: add AI description generation logic"
```

---

## Task 9: Manual Testing Checklist

**Step 1: Test Options Page**

- [ ] Open options page
- [ ] Verify AI Settings section appears
- [ ] Enter OpenRouter API key
- [ ] Change model filter to "Free" - models should load
- [ ] Change model filter to "All" - models should load
- [ ] Select a model
- [ ] Select generation language
- [ ] Enter custom prompt
- [ ] Save settings
- [ ] Reload page - settings should persist

**Step 2: Test Tag Manager - No API Key**

- [ ] Remove API key from settings
- [ ] Open tag manager
- [ ] Edit a tag with 2+ posts
- [ ] ✨ button should be hidden
- [ ] Hint should show "API key not configured"

**Step 3: Test Tag Manager - Tag with <2 Posts**

- [ ] Configure API key
- [ ] Edit a tag with 0-1 posts
- [ ] ✨ button should be hidden
- [ ] Hint should show "Minimum 2 posts required"

**Step 4: Test Generation - Empty Description**

- [ ] Edit a tag with 2+ posts and no description
- [ ] ✨ button should be visible
- [ ] Click ✨
- [ ] Text should stream into textarea
- [ ] Character counter should update
- [ ] Button should show spinner during generation

**Step 5: Test Generation - Existing Description**

- [ ] Edit a tag with existing description
- [ ] Click ✨
- [ ] Confirmation modal should appear
- [ ] Click "Replace"
- [ ] New text should stream in

**Step 6: Test Generation - Cancel**

- [ ] Start generation
- [ ] Close modal
- [ ] Generation should abort
- [ ] Toast should show "Generation interrupted"

**Step 7: Test Error Handling**

- [ ] Enter invalid API key
- [ ] Try to generate
- [ ] Error toast should appear

**Step 8: Commit if all tests pass**

```bash
git add -A
git commit -m "test: verify AI description generation feature"
```

---

## Task 10: Final Cleanup and Push

**Step 1: Run any linting/formatting**

```bash
# If project has linting configured
npm run lint --if-present
```

**Step 2: Verify all files are committed**

```bash
git status
```

**Step 3: Push to remote**

```bash
git push origin main
```
