# AI Description Generation for Tags

## Overview

Integration of OpenRouter API to generate SEO-optimized tag descriptions using LLM. The feature adds AI settings to the options page and a generation button in the tag editor.

## Settings (Options Page)

New section "AI Settings" below Ghost API settings.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| API Key | password input | OpenRouter API key (sk-or-v1-...) |
| Model Filter | select | Recommended / Free / All |
| Model | select | Dynamically loaded model list |
| Generation Language | select | Language for generated text |
| Custom Prompt | textarea | Optional additional instructions |

### Recommended Models (hardcoded)

```
google/gemini-2.0-flash-exp:free
meta-llama/llama-3.1-8b-instruct:free
google/gemma-2-9b-it:free
openai/gpt-4o-mini
anthropic/claude-3-haiku
mistralai/mistral-7b-instruct:free
```

### Model Loading

- Filter "Recommended": show hardcoded list
- Filter "Free": fetch from OpenRouter API, filter by `pricing.prompt === "0"`
- Filter "All": fetch full list from OpenRouter API
- Cache models in `chrome.storage.local` for 3 hours

## Tag Manager UI

### Generate Button

- Icon: ✨ positioned right of "Description" label
- Visible only when: tag has >= 2 posts AND API key is configured
- When posts < 2: show hint "Minimum 2 posts required for AI generation"

### Character Counter

- Displayed below textarea: `342 / 500`
- Updates in real-time during streaming and manual editing
- Turns red when > 500 (warning only, does not block)

### Generation Flow

1. User clicks ✨
2. If description has text → confirmation modal "Replace existing description?"
3. Icon changes to spinner
4. Text streams into textarea character by character (SSE)
5. On completion → spinner returns to ✨

### Error Handling

| Error | Action |
|-------|--------|
| No API key | Toast "API key not configured" + "Settings" button |
| Invalid key (401) | Toast "Invalid API key" |
| Model unavailable | Toast "Model unavailable, try another" |
| Network error | Toast "Network error, try again" |
| Rate limit | Toast "Rate limit exceeded, wait and retry" |
| Stream interrupted | Keep received text, toast "Generation interrupted" |

## Context & Prompt

### Context Collection

- Fetch last 10 posts from tag
- Extract: title, meta_description or custom_excerpt

### System Prompt

```
You are an SEO specialist writing tag descriptions for a blog.

Task: Write a concise description for the tag "{tagName}".

Requirements:
- Maximum 500 characters
- Language: {language}
- SEO-optimized: include relevant keywords naturally
- Describe what readers will find in this category
- Do not use quotes around the text
- Do not include the tag name at the very beginning

{customPrompt ? `Additional instructions: ${customPrompt}` : ''}

Context - recent posts in this tag:
{posts.map(p => `- ${p.title}${p.description ? ': ' + p.description : ''}`).join('\n')}
```

### User Message

```
Generate the description.
```

## Technical Architecture

### New Files

```
lib/openrouter.js — OpenRouter API client (requests, streaming)
```

### Modified Files

```
options/options.html — AI Settings section
options/options.js   — save AI settings, load models
tags/tags.html       — ✨ button, hint, character counter
tags/tags.js         — generation logic, streaming to textarea
tags/tags.css        — button and state styles
_locales/*/messages.json — new localization strings
```

### Storage Keys

```javascript
{
  openrouterApiKey: 'sk-or-v1-...',
  openrouterModel: 'google/gemini-2.0-flash-exp:free',
  openrouterLanguage: 'en',
  openrouterCustomPrompt: '',
  openrouterModelsCache: [...],
  openrouterModelsCacheTime: 1234567890
}
```

### OpenRouter API Call

```javascript
// POST https://openrouter.ai/api/v1/chat/completions
{
  model: 'google/gemini-2.0-flash-exp:free',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Generate the description.' }
  ],
  stream: true,
  max_tokens: 200
}
```

## Edge Cases

| Situation | Behavior |
|-----------|----------|
| Posts < 2 | ✨ hidden, hint shown |
| Posts 2-10 | Use all posts |
| Posts > 10 | Use last 10 |
| Click ✨ during generation | Ignored (button disabled) |
| Close modal during generation | Abort stream |
| Generated text > 500 chars | Keep full text, user edits manually |
