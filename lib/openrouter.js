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
