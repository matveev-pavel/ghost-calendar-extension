# Ghost Calendar v2 — План реализации

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Добавить drag & drop, отображение опубликованных постов, inline-редактирование тегов и timeline-календарь в Chrome-расширение Ghost Calendar.

**Architecture:** Расширяем GhostAPI класс новыми методами (update post, get published, get tags). Переписываем рендер списка с поддержкой HTML5 Drag and Drop API и inline-тегов. Заменяем сетку календаря на вертикальный timeline с drag & drop между днями.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JS, HTML5 Drag and Drop API, Ghost Admin API v5, Vitest (тестирование)

---

### Task 1: Настройка тестового окружения

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `tests/setup.js`

**Step 1: Инициализировать package.json**

```json
{
  "name": "ghost-calendar-extension",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Создать vitest.config.js**

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js']
  }
});
```

**Step 3: Создать tests/setup.js с моками Chrome API**

```javascript
// Мок chrome.storage
globalThis.chrome = {
  storage: {
    sync: {
      get: async (keys) => ({}),
      set: async (data) => {}
    },
    local: {
      get: async (keys) => ({}),
      set: async (data) => {}
    }
  },
  tabs: {
    create: async (opts) => ({})
  },
  runtime: {
    openOptionsPage: () => {}
  }
};

// Мок crypto.subtle
globalThis.crypto = {
  subtle: {
    importKey: async () => ({}),
    sign: async () => new ArrayBuffer(32)
  }
};

// Мок fetch
globalThis.fetch = async (url, opts) => ({
  ok: true,
  json: async () => ({ posts: [], tags: [] })
});

// Мок btoa
if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}
```

**Step 4: Установить зависимости**

Run: `npm install`
Expected: node_modules создан, vitest установлен

**Step 5: Проверить что vitest запускается**

Run: `npx vitest run`
Expected: "No test files found" (пока тестов нет — это нормально)

**Step 6: Коммит**

```bash
git add package.json vitest.config.js tests/setup.js
git commit -m "chore: настройка vitest для тестирования"
```

---

### Task 2: Исправить метод request() для поддержки PUT с body

**Files:**
- Modify: `lib/api.js:105-125`
- Create: `tests/api-request.test.js`

**Step 1: Написать failing test**

Создать `tests/api-request.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Импортируем через динамический eval, т.к. файл не ESM
let GhostAPI;
beforeEach(async () => {
  // Сбрасываем моки
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ posts: [{ id: '1', title: 'Test' }] })
  });

  // Загружаем модуль заново
  const code = (await import('fs')).readFileSync('./lib/api.js', 'utf-8');
  const module = { exports: {} };
  const fn = new Function('module', 'exports', 'chrome', 'crypto', 'fetch', 'btoa', code);
  fn(module, module.exports, globalThis.chrome, globalThis.crypto, globalThis.fetch, globalThis.btoa);
  GhostAPI = module.exports.GhostAPI;
});

describe('GhostAPI.request()', () => {
  it('отправляет PUT запрос с body и Content-Type', async () => {
    const api = new GhostAPI('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    await api.request('/posts/123/', {
      method: 'PUT',
      body: JSON.stringify({ posts: [{ published_at: '2026-01-25T10:00:00Z' }] })
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://blog.example.com/ghost/api/admin/posts/123/',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ posts: [{ published_at: '2026-01-25T10:00:00Z' }] }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    );
  });
});
```

**Step 2: Запустить тест — убедиться что проходит**

Run: `npx vitest run tests/api-request.test.js`
Expected: PASS (метод request уже передаёт options через spread)

**Step 3: Коммит**

```bash
git add tests/api-request.test.js
git commit -m "test: тест для PUT запросов через request()"
```

---

### Task 3: API — метод getPublishedPosts

**Files:**
- Modify: `lib/api.js:135` (после getScheduledPosts)
- Create: `tests/api-published.test.js`

**Step 1: Написать failing test**

Создать `tests/api-published.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

let GhostAPI;
beforeEach(async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      posts: [
        { id: '1', title: 'Published Post', status: 'published', published_at: '2026-01-23T10:00:00Z' }
      ]
    })
  });

  const code = (await import('fs')).readFileSync('./lib/api.js', 'utf-8');
  const module = { exports: {} };
  const fn = new Function('module', 'exports', 'chrome', 'crypto', 'fetch', 'btoa', code);
  fn(module, module.exports, globalThis.chrome, globalThis.crypto, globalThis.fetch, globalThis.btoa);
  GhostAPI = module.exports.GhostAPI;
});

describe('GhostAPI.getPublishedPosts()', () => {
  it('вызывает API с фильтром published и датой от вчера', async () => {
    const api = new GhostAPI('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    const posts = await api.getPublishedPosts();

    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe('Published Post');

    const url = fetch.mock.calls[0][0];
    expect(url).toContain('status:published');
    expect(url).toContain('published_at');
    expect(url).toContain('include=tags');
    expect(url).toContain('fields=');
  });

  it('возвращает пустой массив если постов нет', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ posts: [] })
    });

    const api = new GhostAPI('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    const posts = await api.getPublishedPosts();
    expect(posts).toEqual([]);
  });
});
```

**Step 2: Запустить тест — убедиться что FAIL**

Run: `npx vitest run tests/api-published.test.js`
Expected: FAIL — "api.getPublishedPosts is not a function"

**Step 3: Реализовать метод getPublishedPosts**

В `lib/api.js` после метода `getScheduledPosts()` (строка 135), добавить:

```javascript
  /**
   * Получение опубликованных постов за последние 2 дня
   */
  async getPublishedPosts() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const filter = `status:published+published_at:>='${yesterday.toISOString()}'`;
    const data = await this.request(
      `/posts/?filter=${encodeURIComponent(filter)}&order=published_at%20asc&fields=id,title,slug,status,published_at,feature_image,custom_excerpt,updated_at&include=tags&limit=all`
    );
    return data.posts || [];
  }
```

**Step 4: Запустить тест — убедиться что PASS**

Run: `npx vitest run tests/api-published.test.js`
Expected: PASS

**Step 5: Коммит**

```bash
git add lib/api.js tests/api-published.test.js
git commit -m "feat(api): добавить метод getPublishedPosts"
```

---

### Task 4: API — метод updatePostDate

**Files:**
- Modify: `lib/api.js` (после getPublishedPosts)
- Create: `tests/api-update-date.test.js`

**Step 1: Написать failing test**

Создать `tests/api-update-date.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

let GhostAPI;
beforeEach(async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      posts: [{
        id: '1',
        published_at: '2026-01-25T10:00:00Z',
        updated_at: '2026-01-23T12:00:00Z'
      }]
    })
  });

  const code = (await import('fs')).readFileSync('./lib/api.js', 'utf-8');
  const module = { exports: {} };
  const fn = new Function('module', 'exports', 'chrome', 'crypto', 'fetch', 'btoa', code);
  fn(module, module.exports, globalThis.chrome, globalThis.crypto, globalThis.fetch, globalThis.btoa);
  GhostAPI = module.exports.GhostAPI;
});

describe('GhostAPI.updatePostDate()', () => {
  it('отправляет PUT с published_at и updated_at', async () => {
    const api = new GhostAPI('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    const result = await api.updatePostDate('post-1', '2026-01-25T10:00:00Z', '2026-01-23T09:00:00Z');

    expect(result.published_at).toBe('2026-01-25T10:00:00Z');

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain('/posts/post-1/');
    expect(opts.method).toBe('PUT');
    const body = JSON.parse(opts.body);
    expect(body.posts[0].published_at).toBe('2026-01-25T10:00:00Z');
    expect(body.posts[0].updated_at).toBe('2026-01-23T09:00:00Z');
  });
});
```

**Step 2: Запустить тест — FAIL**

Run: `npx vitest run tests/api-update-date.test.js`
Expected: FAIL — "api.updatePostDate is not a function"

**Step 3: Реализовать метод**

В `lib/api.js` после `getPublishedPosts()` добавить:

```javascript
  /**
   * Обновление даты публикации поста
   */
  async updatePostDate(postId, newDate, updatedAt) {
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
```

**Step 4: Запустить тест — PASS**

Run: `npx vitest run tests/api-update-date.test.js`
Expected: PASS

**Step 5: Коммит**

```bash
git add lib/api.js tests/api-update-date.test.js
git commit -m "feat(api): добавить метод updatePostDate"
```

---

### Task 5: API — метод updatePostTags

**Files:**
- Modify: `lib/api.js` (после updatePostDate)
- Create: `tests/api-update-tags.test.js`

**Step 1: Написать failing test**

Создать `tests/api-update-tags.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

let GhostAPI;
beforeEach(async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      posts: [{
        id: '1',
        tags: [{ id: 't1', name: 'ai' }, { id: 't2', name: 'guide' }],
        updated_at: '2026-01-23T12:00:00Z'
      }]
    })
  });

  const code = (await import('fs')).readFileSync('./lib/api.js', 'utf-8');
  const module = { exports: {} };
  const fn = new Function('module', 'exports', 'chrome', 'crypto', 'fetch', 'btoa', code);
  fn(module, module.exports, globalThis.chrome, globalThis.crypto, globalThis.fetch, globalThis.btoa);
  GhostAPI = module.exports.GhostAPI;
});

describe('GhostAPI.updatePostTags()', () => {
  it('отправляет PUT с массивом тегов', async () => {
    const api = new GhostAPI('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    const tags = [{ id: 't1', name: 'ai' }, { id: 't2', name: 'guide' }];
    const result = await api.updatePostTags('post-1', tags, '2026-01-23T09:00:00Z');

    expect(result.tags).toHaveLength(2);

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain('/posts/post-1/');
    expect(opts.method).toBe('PUT');
    const body = JSON.parse(opts.body);
    expect(body.posts[0].tags).toEqual(tags);
    expect(body.posts[0].updated_at).toBe('2026-01-23T09:00:00Z');
  });

  it('преобразует строковые теги в объекты с name', async () => {
    const api = new GhostAPI('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    await api.updatePostTags('post-1', ['ai', 'guide'], '2026-01-23T09:00:00Z');

    const [, opts] = fetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.posts[0].tags).toEqual([{ name: 'ai' }, { name: 'guide' }]);
  });
});
```

**Step 2: Запустить тест — FAIL**

Run: `npx vitest run tests/api-update-tags.test.js`
Expected: FAIL

**Step 3: Реализовать метод**

В `lib/api.js` после `updatePostDate()` добавить:

```javascript
  /**
   * Обновление тегов поста
   */
  async updatePostTags(postId, tags, updatedAt) {
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
```

**Step 4: Запустить тест — PASS**

Run: `npx vitest run tests/api-update-tags.test.js`
Expected: PASS

**Step 5: Коммит**

```bash
git add lib/api.js tests/api-update-tags.test.js
git commit -m "feat(api): добавить метод updatePostTags"
```

---

### Task 6: API — метод getAllTags

**Files:**
- Modify: `lib/api.js` (после updatePostTags)
- Create: `tests/api-tags.test.js`

**Step 1: Написать failing test**

Создать `tests/api-tags.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

let GhostAPI;
beforeEach(async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      tags: [
        { id: 't1', name: 'ai', slug: 'ai' },
        { id: 't2', name: 'guide', slug: 'guide' }
      ]
    })
  });

  const code = (await import('fs')).readFileSync('./lib/api.js', 'utf-8');
  const module = { exports: {} };
  const fn = new Function('module', 'exports', 'chrome', 'crypto', 'fetch', 'btoa', code);
  fn(module, module.exports, globalThis.chrome, globalThis.crypto, globalThis.fetch, globalThis.btoa);
  GhostAPI = module.exports.GhostAPI;
});

describe('GhostAPI.getAllTags()', () => {
  it('загружает все теги блога', async () => {
    const api = new GhostAPI('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    const tags = await api.getAllTags();

    expect(tags).toHaveLength(2);
    expect(tags[0].name).toBe('ai');

    const url = fetch.mock.calls[0][0];
    expect(url).toContain('/tags/');
    expect(url).toContain('limit=all');
  });
});
```

**Step 2: Запустить тест — FAIL**

Run: `npx vitest run tests/api-tags.test.js`
Expected: FAIL

**Step 3: Реализовать метод**

В `lib/api.js` после `updatePostTags()` добавить:

```javascript
  /**
   * Получение всех тегов блога
   */
  async getAllTags() {
    const data = await this.request('/tags/?limit=all&fields=id,name,slug');
    return data.tags || [];
  }
```

**Step 4: Запустить тест — PASS**

Run: `npx vitest run tests/api-tags.test.js`
Expected: PASS

**Step 5: Обновить getScheduledPosts — добавить поля tags, status, updated_at**

Заменить метод `getScheduledPosts` в `lib/api.js`:

```javascript
  async getScheduledPosts() {
    const data = await this.request(
      '/posts/?filter=status:scheduled&order=published_at%20asc&fields=id,title,slug,status,published_at,feature_image,custom_excerpt,updated_at&include=tags&limit=all'
    );
    return data.posts || [];
  }
```

**Step 6: Запустить все тесты**

Run: `npx vitest run`
Expected: все PASS

**Step 7: Коммит**

```bash
git add lib/api.js tests/api-tags.test.js
git commit -m "feat(api): добавить getAllTags и расширить поля getScheduledPosts"
```

---

### Task 7: Обновить загрузку данных в sidepanel.js

**Files:**
- Modify: `sidepanel/sidepanel.js:1-5` (состояние)
- Modify: `sidepanel/sidepanel.js:86-116` (loadPosts)

**Step 1: Обновить состояние приложения**

Заменить строки 1-5 в `sidepanel/sidepanel.js`:

```javascript
// Состояние приложения
let posts = [];
let allTags = [];
let currentView = 'list';
let currentMonth = new Date();
let blogUrl = '';
let api = null;
```

**Step 2: Обновить функцию loadPosts**

Заменить функцию `loadPosts` (строки 86-116):

```javascript
async function loadPosts() {
  showState('loading');

  try {
    api = await createAPIFromStorage();
    blogUrl = api.blogUrl;

    const [scheduled, published, tags] = await Promise.all([
      api.getScheduledPosts(),
      api.getPublishedPosts(),
      api.getAllTags()
    ]);

    // Объединяем и сортируем по дате
    posts = [...published, ...scheduled].sort(
      (a, b) => new Date(a.published_at) - new Date(b.published_at)
    );
    allTags = tags;

    // Заполнить datalist для автодополнения тегов
    const datalist = document.getElementById('tags-datalist');
    if (datalist) {
      datalist.innerHTML = allTags.map(t => `<option value="${escapeHtml(t.name)}">`).join('');
    }

    if (posts.length === 0) {
      showState('empty');
      return;
    }

    const { preferredView } = await chrome.storage.local.get(['preferredView']);
    if (preferredView) {
      currentView = preferredView;
      document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === currentView);
      });
    }

    showState('loaded');
    renderList();
    renderCalendar();
  } catch (error) {
    console.error('Ошибка загрузки:', error);
    errorMessage.textContent = error.message;
    showState('error');
  }
}
```

**Step 3: Проверить**

Загрузить расширение в Chrome, открыть side panel — должны загрузиться и опубликованные, и запланированные посты.

**Step 4: Коммит**

```bash
git add sidepanel/sidepanel.js
git commit -m "feat: загрузка опубликованных постов и тегов"
```

---

### Task 8: Обновить заголовок и HTML-структуру

**Files:**
- Modify: `sidepanel/sidepanel.html:13`
- Modify: `sidepanel/sidepanel.html:94` (tooltip → datalist)

**Step 1: Заменить заголовок**

Строка 13 в `sidepanel/sidepanel.html` — заменить:
```html
<h1>Ghost Calendar</h1>
```

**Step 2: Заменить tooltip div на datalist**

Удалить строку 94:
```html
<div class="tooltip" id="tooltip"></div>
```

Добавить вместо неё:
```html
<datalist id="tags-datalist"></datalist>
```

**Step 3: Проверить**

Открыть side panel — заголовок "Ghost Calendar" отображается.

**Step 4: Коммит**

```bash
git add sidepanel/sidepanel.html
git commit -m "feat: заголовок Ghost Calendar и datalist для тегов"
```

---

### Task 9: Новый рендер списка — карточки со статусами и тегами

**Files:**
- Modify: `sidepanel/sidepanel.js:118-178` (renderList)

**Step 1: Удалить ссылку на tooltip**

Удалить строку 16 из `sidepanel/sidepanel.js`:
```javascript
const tooltip = document.getElementById('tooltip');
```

**Step 2: Переписать функцию renderList**

Заменить целиком функцию `renderList` (строки 118-178):

```javascript
function renderList() {
  const grouped = {};

  posts.forEach(post => {
    const date = new Date(post.published_at);
    const dateKey = date.toISOString().split('T')[0];

    if (!grouped[dateKey]) {
      grouped[dateKey] = { date, posts: [] };
    }
    grouped[dateKey].posts.push(post);
  });

  const sortedDates = Object.keys(grouped).sort();

  postsList.innerHTML = sortedDates.map(dateKey => {
    const group = grouped[dateKey];
    const dateStr = formatDateHeader(group.date);

    const postsHtml = group.posts.map(post => {
      const time = formatTime(new Date(post.published_at));
      const isScheduled = post.status === 'scheduled';
      const statusClass = isScheduled ? 'status-scheduled' : 'status-published';
      const statusText = isScheduled ? 'запланирован' : 'опубликован';
      const dragHandle = isScheduled
        ? '<div class="drag-handle" draggable="true">⠿</div>'
        : '';

      const imageHtml = post.feature_image
        ? `<img class="post-image" src="${escapeHtml(post.feature_image)}" alt="">`
        : `<div class="post-image post-image-placeholder"></div>`;

      const excerptHtml = post.custom_excerpt
        ? `<span class="post-excerpt">${escapeHtml(post.custom_excerpt)}</span>`
        : '';

      const tagsHtml = renderPostTags(post);

      return `
        <div class="post-item ${isScheduled ? 'draggable' : ''}"
             data-id="${escapeHtml(String(post.id))}"
             data-status="${post.status}"
             data-updated-at="${escapeHtml(post.updated_at)}">
          ${dragHandle}
          ${imageHtml}
          <div class="post-content">
            <span class="post-title">${escapeHtml(post.title)}</span>
            ${excerptHtml}
            <div class="post-meta">
              <span class="post-time">${time}</span>
              <span class="post-status ${statusClass}">${statusText}</span>
            </div>
            ${tagsHtml}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="date-group" data-date="${dateKey}">
        <div class="date-header">${dateStr}</div>
        ${postsHtml}
      </div>
    `;
  }).join('');

  // Клик на пост — открыть редактор
  postsList.querySelectorAll('.post-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.drag-handle') || e.target.closest('.tag-chip') ||
          e.target.closest('.tag-add') || e.target.closest('.tag-input')) return;
      const postId = item.dataset.id;
      openEditor(postId);
    });
  });

  setupTagListeners();
  setupDragAndDrop();
}
```

**Step 3: Добавить функцию renderPostTags**

Добавить после `renderList`:

```javascript
function renderPostTags(post) {
  const tags = post.tags || [];
  const tagsChips = tags.map(tag =>
    `<span class="tag-chip" data-tag-id="${escapeHtml(tag.id)}" data-tag-name="${escapeHtml(tag.name)}">${escapeHtml(tag.name)}<span class="tag-remove">×</span></span>`
  ).join('');

  return `
    <div class="post-tags" data-post-id="${escapeHtml(String(post.id))}">
      ${tagsChips}
      <span class="tag-add" title="Добавить тег">+</span>
    </div>
  `;
}
```

**Step 4: Проверить**

Открыть side panel — посты отображаются с тегами, статусами и drag-handle для scheduled.

**Step 5: Коммит**

```bash
git add sidepanel/sidepanel.js
git commit -m "feat: новый рендер списка с тегами и статусами"
```

---

### Task 10: Логика тегов — добавление и удаление

**Files:**
- Modify: `sidepanel/sidepanel.js` (после renderPostTags)

**Step 1: Добавить setupTagListeners**

```javascript
function setupTagListeners() {
  // Удаление тега
  postsList.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const chip = e.target.closest('.tag-chip');
      const container = e.target.closest('.post-tags');
      const postId = container.dataset.postId;
      const tagName = chip.dataset.tagName;

      const post = posts.find(p => String(p.id) === postId);
      if (!post) return;

      const newTags = (post.tags || []).filter(t => t.name !== tagName);
      try {
        const updated = await api.updatePostTags(postId, newTags, post.updated_at);
        post.tags = updated.tags;
        post.updated_at = updated.updated_at;
        chip.remove();
      } catch (err) {
        console.error('Ошибка удаления тега:', err);
      }
    });
  });

  // Добавление тега — клик на "+"
  postsList.querySelectorAll('.tag-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const container = e.target.closest('.post-tags');
      if (container.querySelector('.tag-input')) return;

      const input = document.createElement('input');
      input.className = 'tag-input';
      input.placeholder = 'тег...';
      input.setAttribute('list', 'tags-datalist');
      container.insertBefore(input, btn);
      btn.style.display = 'none';
      input.focus();

      input.addEventListener('keydown', async (ev) => {
        if (ev.key === 'Enter' && input.value.trim()) {
          const tagName = input.value.trim();
          const postId = container.dataset.postId;
          const post = posts.find(p => String(p.id) === postId);
          if (!post) return;

          const newTags = [...(post.tags || []), { name: tagName }];
          try {
            const updated = await api.updatePostTags(postId, newTags, post.updated_at);
            post.tags = updated.tags;
            post.updated_at = updated.updated_at;
            const postEl = postsList.querySelector(`[data-id="${postId}"]`);
            const tagsContainer = postEl.querySelector('.post-tags');
            tagsContainer.outerHTML = renderPostTags(post);
            setupTagListeners();
          } catch (err) {
            console.error('Ошибка добавления тега:', err);
          }
        } else if (ev.key === 'Escape') {
          input.remove();
          btn.style.display = '';
        }
      });

      input.addEventListener('blur', () => {
        setTimeout(() => {
          if (container.contains(input)) {
            input.remove();
            btn.style.display = '';
          }
        }, 150);
      });
    });
  });
}
```

**Step 2: Проверить**

1. Hover на тег — появляется `×`, клик удаляет
2. Клик на `+` — появляется input, Enter добавляет тег
3. Escape — закрывает input

**Step 3: Коммит**

```bash
git add sidepanel/sidepanel.js
git commit -m "feat: inline редактирование тегов"
```

---

### Task 11: Drag & Drop в списочном виде

**Files:**
- Modify: `sidepanel/sidepanel.js` (после setupTagListeners)

**Step 1: Добавить setupDragAndDrop**

```javascript
function setupDragAndDrop() {
  let draggedPostId = null;

  postsList.querySelectorAll('.post-item.draggable').forEach(item => {
    const handle = item.querySelector('.drag-handle');
    if (!handle) return;

    handle.addEventListener('dragstart', (e) => {
      draggedPostId = item.dataset.id;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.id);
    });

    handle.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      document.querySelectorAll('.date-group.drag-over').forEach(z => z.classList.remove('drag-over'));
      draggedPostId = null;
    });
  });

  // Дропзоны — группы дат
  postsList.querySelectorAll('.date-group').forEach(group => {
    group.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      group.classList.add('drag-over');
    });

    group.addEventListener('dragleave', () => {
      group.classList.remove('drag-over');
    });

    group.addEventListener('drop', async (e) => {
      e.preventDefault();
      group.classList.remove('drag-over');

      const postId = e.dataTransfer.getData('text/plain');
      const targetDate = group.dataset.date;
      if (!postId || !targetDate) return;

      const post = posts.find(p => String(p.id) === postId);
      if (!post) return;

      // Сохраняем время, меняем только дату
      const oldDate = new Date(post.published_at);
      const newDate = new Date(targetDate);
      newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), oldDate.getSeconds());

      try {
        const updated = await api.updatePostDate(postId, newDate.toISOString(), post.updated_at);
        post.published_at = updated.published_at;
        post.updated_at = updated.updated_at;
        posts.sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
        renderList();
        renderCalendar();
      } catch (err) {
        console.error('Ошибка обновления даты:', err);
      }
    });
  });
}
```

**Step 2: Проверить**

1. Hover на scheduled-пост — появляется drag handle `⠿`
2. Перетащить пост на другую группу дат — дата обновляется
3. Пост перемещается в новую группу

**Step 3: Коммит**

```bash
git add sidepanel/sidepanel.js
git commit -m "feat: drag & drop для изменения дат постов"
```

---

### Task 12: Обновить formatDateHeader — поддержка "Вчера"

**Files:**
- Modify: `sidepanel/sidepanel.js` (функция formatDateHeader, строки 327-338)

**Step 1: Заменить функцию formatDateHeader**

```javascript
function formatDateHeader(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateStr = date.toDateString();
  if (dateStr === yesterday.toDateString()) return 'Вчера';
  if (dateStr === today.toDateString()) return 'Сегодня';
  if (dateStr === tomorrow.toDateString()) return 'Завтра';

  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  return date.toLocaleDateString('ru-RU', options);
}
```

**Step 2: Коммит**

```bash
git add sidepanel/sidepanel.js
git commit -m "feat: поддержка Вчера в заголовках дат"
```

---

### Task 13: Новый календарный вид — вертикальный timeline (HTML)

**Files:**
- Modify: `sidepanel/sidepanel.html:64-91` (calendar-view блок)

**Step 1: Заменить блок calendar-view**

Заменить строки 64-91 в `sidepanel/sidepanel.html`:

```html
    <!-- Режим календаря (timeline) -->
    <div class="view calendar-view" id="calendar-view" style="display: none;">
      <div class="calendar-nav">
        <button class="nav-btn" id="prev-month">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.354 1.646a.5.5 0 010 .708L5.707 8l5.647 5.646a.5.5 0 01-.708.708l-6-6a.5.5 0 010-.708l6-6a.5.5 0 01.708 0z"/>
          </svg>
        </button>
        <span class="month-title" id="month-title">Январь 2026</span>
        <button class="nav-btn" id="next-month">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.646 1.646a.5.5 0 01.708 0l6 6a.5.5 0 010 .708l-6 6a.5.5 0 01-.708-.708L10.293 8 4.646 2.354a.5.5 0 010-.708z"/>
          </svg>
        </button>
      </div>
      <div class="timeline" id="timeline"></div>
    </div>
```

**Step 2: Удалить ссылку на calendarDays из JS**

В `sidepanel/sidepanel.js` удалить строку 14:
```javascript
const calendarDays = document.getElementById('calendar-days');
```

**Step 3: Коммит**

```bash
git add sidepanel/sidepanel.html sidepanel/sidepanel.js
git commit -m "feat: HTML структура timeline календаря"
```

---

### Task 14: Новый календарный вид — логика рендера

**Files:**
- Modify: `sidepanel/sidepanel.js:180-318` (renderCalendar + tooltip функции)

**Step 1: Заменить renderCalendar и удалить tooltip-функции**

Удалить функции `renderCalendar`, `showTooltip`, `updateTooltipPosition`, `hideTooltip` (строки 180-318). Заменить на:

```javascript
function renderCalendar() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const timeline = document.getElementById('timeline');

  monthTitle.textContent = `${monthNames[month]} ${year}`;

  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Группируем посты по дням этого месяца
  const postsByDay = {};
  posts.forEach(post => {
    const date = new Date(post.published_at);
    if (date.getMonth() === month && date.getFullYear() === year) {
      const day = date.getDate();
      if (!postsByDay[day]) postsByDay[day] = [];
      postsByDay[day].push(post);
    }
  });

  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  let html = '';
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    const dayName = dayNames[date.getDay()];
    const dayPosts = postsByDay[day] || [];
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    let label = '';
    if (isToday) label = ' (сегодня)';
    else if (isYesterday) label = ' (вчера)';

    const dayClass = `timeline-day${isToday ? ' timeline-today' : ''}${dayPosts.length > 0 ? ' has-posts' : ''}`;

    const postsHtml = dayPosts.map(post => {
      const time = formatTime(new Date(post.published_at));
      const isScheduled = post.status === 'scheduled';
      const statusIcon = isScheduled ? '○' : '●';
      const statusClass = isScheduled ? 'status-scheduled' : 'status-published';

      return `
        <div class="timeline-post ${isScheduled ? 'draggable' : ''}"
             data-id="${escapeHtml(String(post.id))}"
             data-status="${post.status}"
             data-updated-at="${escapeHtml(post.updated_at)}"
             ${isScheduled ? 'draggable="true"' : ''}>
          <span class="timeline-post-time">${time}</span>
          <span class="timeline-post-status ${statusClass}">${statusIcon}</span>
          <span class="timeline-post-title">${escapeHtml(post.title)}</span>
        </div>
      `;
    }).join('');

    html += `
      <div class="${dayClass}" data-date="${date.toISOString().split('T')[0]}">
        <div class="timeline-day-header">
          <span class="timeline-day-name">${dayName} ${day}${label}</span>
        </div>
        <div class="timeline-day-posts">
          ${postsHtml || '<div class="timeline-empty"></div>'}
        </div>
      </div>
    `;
  }

  timeline.innerHTML = html;

  // Клик на пост — открыть редактор
  timeline.querySelectorAll('.timeline-post').forEach(item => {
    item.addEventListener('click', () => {
      openEditor(item.dataset.id);
    });
  });

  // Drag & drop в timeline
  setupTimelineDragAndDrop();

  // Скролл к сегодню
  const todayEl = timeline.querySelector('.timeline-today');
  if (todayEl) {
    todayEl.scrollIntoView({ block: 'center' });
  }
}

function setupTimelineDragAndDrop() {
  const timeline = document.getElementById('timeline');

  timeline.querySelectorAll('.timeline-post.draggable').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.id);
      item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      timeline.querySelectorAll('.timeline-day.drag-over').forEach(d => d.classList.remove('drag-over'));
    });
  });

  timeline.querySelectorAll('.timeline-day').forEach(day => {
    day.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      day.classList.add('drag-over');
    });

    day.addEventListener('dragleave', () => {
      day.classList.remove('drag-over');
    });

    day.addEventListener('drop', async (e) => {
      e.preventDefault();
      day.classList.remove('drag-over');

      const postId = e.dataTransfer.getData('text/plain');
      const targetDate = day.dataset.date;
      if (!postId || !targetDate) return;

      const post = posts.find(p => String(p.id) === postId);
      if (!post) return;

      const oldDate = new Date(post.published_at);
      const newDate = new Date(targetDate);
      newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), oldDate.getSeconds());

      try {
        const updated = await api.updatePostDate(postId, newDate.toISOString(), post.updated_at);
        post.published_at = updated.published_at;
        post.updated_at = updated.updated_at;
        posts.sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
        renderCalendar();
        renderList();
      } catch (err) {
        console.error('Ошибка обновления даты:', err);
      }
    });
  });
}
```

**Step 2: Проверить**

Переключить на календарный вид — timeline с днями месяца, постами, drag & drop.

**Step 3: Коммит**

```bash
git add sidepanel/sidepanel.js
git commit -m "feat: вертикальный timeline вместо сетки календаря"
```

---

### Task 15: Стили — карточки, теги, drag & drop

**Files:**
- Modify: `sidepanel/sidepanel.css` (после `.post-time`, строка 231)

**Step 1: Добавить стили для drag handle, статуса и тегов**

После строки 231 (`.post-time { ... }`) добавить:

```css
/* Drag Handle */
.drag-handle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  color: #a0a0a0;
  cursor: grab;
  font-size: 14px;
  flex-shrink: 0;
  user-select: none;
  align-self: center;
}

.post-item.draggable:hover .drag-handle {
  display: flex;
}

.post-item.dragging {
  opacity: 0.5;
  border-color: #30cf43;
}

.date-group.drag-over {
  background: #f0fdf0;
  border-radius: 6px;
  box-shadow: inset 0 0 0 2px #30cf43;
}

/* Post Meta */
.post-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.post-status {
  font-size: 11px;
  font-weight: 500;
}

.post-status.status-scheduled {
  color: #30cf43;
}

.post-status.status-published {
  color: #a0a0a0;
}

/* Tags */
.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
  align-items: center;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  background: #f4f5f6;
  border-radius: 3px;
  font-size: 11px;
  color: #394047;
  cursor: default;
  transition: background 0.15s;
}

.tag-chip:hover {
  background: #e6e6e6;
}

.tag-remove {
  display: none;
  margin-left: 2px;
  cursor: pointer;
  color: #a0a0a0;
  font-weight: bold;
  line-height: 1;
}

.tag-chip:hover .tag-remove {
  display: inline;
}

.tag-remove:hover {
  color: #ef4444;
}

.tag-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: #f4f5f6;
  border-radius: 3px;
  font-size: 12px;
  color: #a0a0a0;
  cursor: pointer;
  transition: all 0.15s;
}

.tag-add:hover {
  background: #e6e6e6;
  color: #15171a;
}

.tag-input {
  border: 1px solid #30cf43;
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 11px;
  outline: none;
  width: 80px;
  font-family: inherit;
}
```

**Step 2: Коммит**

```bash
git add sidepanel/sidepanel.css
git commit -m "feat: стили для drag handle, статусов и тегов"
```

---

### Task 16: Стили — timeline календарь

**Files:**
- Modify: `sidepanel/sidepanel.css` (заменить стили Calendar View, строки 233-402)

**Step 1: Удалить старые стили календаря и tooltip**

Удалить всё от `/* Calendar View */` (строка 233) до конца блока `/* Tooltip */` включая `.tooltip-time` (строка 402).

**Step 2: Добавить новые стили timeline**

На месте удалённого блока вставить:

```css
/* Calendar View - Timeline */
.calendar-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f9fafb;
}

.calendar-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e6e6e6;
}

.month-title {
  font-size: 14px;
  font-weight: 600;
  color: #15171a;
}

.nav-btn {
  background: #fff;
  border: 1px solid #e6e6e6;
  padding: 5px;
  border-radius: 4px;
  cursor: pointer;
  color: #738a94;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-btn:hover {
  border-color: #c5d2d9;
  color: #15171a;
}

/* Timeline */
.timeline {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
}

.timeline-day {
  border-left: 2px solid #e6e6e6;
  margin-left: 8px;
  padding: 0 0 4px 12px;
  transition: all 0.15s;
}

.timeline-day.timeline-today {
  border-left-color: #30cf43;
}

.timeline-day.has-posts {
  padding-bottom: 8px;
}

.timeline-day.drag-over {
  background: #f0fdf0;
  border-radius: 0 6px 6px 0;
  border-left-color: #30cf43;
}

.timeline-day-header {
  padding: 6px 0 2px;
  position: relative;
}

.timeline-day-header::before {
  content: '';
  position: absolute;
  left: -17px;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e6e6e6;
  border: 2px solid #f9fafb;
}

.timeline-today .timeline-day-header::before {
  background: #30cf43;
}

.has-posts .timeline-day-header::before {
  background: #15171a;
}

.timeline-day-name {
  font-size: 12px;
  font-weight: 500;
  color: #738a94;
}

.timeline-today .timeline-day-name {
  color: #30cf43;
  font-weight: 600;
}

.timeline-day-posts {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.timeline-post {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.timeline-post:hover {
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.timeline-post.draggable {
  cursor: grab;
}

.timeline-post.dragging {
  opacity: 0.4;
}

.timeline-post-time {
  font-size: 11px;
  color: #738a94;
  font-weight: 500;
  min-width: 36px;
}

.timeline-post-status {
  font-size: 10px;
  line-height: 1;
}

.timeline-post-status.status-scheduled {
  color: #30cf43;
}

.timeline-post-status.status-published {
  color: #a0a0a0;
}

.timeline-post-title {
  font-size: 12px;
  color: #15171a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timeline-empty {
  height: 4px;
}

/* Timeline scrollbar */
.timeline::-webkit-scrollbar {
  width: 5px;
}

.timeline::-webkit-scrollbar-track {
  background: transparent;
}

.timeline::-webkit-scrollbar-thumb {
  background: #c5d2d9;
  border-radius: 3px;
}
```

**Step 3: Проверить**

Timeline отображается с вертикальной линией, точками-маркерами на днях, посты компактные с иконками статуса.

**Step 4: Коммит**

```bash
git add sidepanel/sidepanel.css
git commit -m "feat: стили timeline календаря"
```

---

### Task 17: Финальная проверка

**Step 1: Запустить все тесты**

Run: `npx vitest run`
Expected: все тесты PASS

**Step 2: Ручная проверка в Chrome**

1. Открыть side panel — заголовок "Ghost Calendar"
2. Список: посты с тегами, drag handle для scheduled, статусы
3. Теги: `×` удаляет, `+` добавляет через input
4. Drag & drop: перетащить scheduled-пост на другой день
5. Timeline: переключить на календарь — вертикальный timeline
6. Timeline drag: перетащить пост на другой день
7. Вчера/Сегодня/Завтра: метки в заголовках дат

**Step 3: Добавить node_modules в .gitignore**

Создать `.gitignore`:

```
node_modules/
.DS_Store
```

**Step 4: Коммит**

```bash
git add .gitignore
git commit -m "chore: добавить .gitignore"
```
