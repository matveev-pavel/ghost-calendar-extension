import { describe, it, expect, vi, beforeEach } from 'vitest';

let GhostAPI;
beforeEach(async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      tags: [
        { id: 't1', name: 'ai', slug: 'ai' },
        { id: 't2', name: 'guide', slug: 'guide' }
      ],
      meta: { pagination: { next: null } }
    })
  });

  const code = (await import('fs')).readFileSync('./lib/api.js', 'utf-8');
  const module = { exports: {} };
  const fn = new Function('module', 'exports', 'chrome', 'crypto', 'fetch', 'btoa', code);
  fn(module, module.exports, globalThis.chrome, globalThis.crypto, globalThis.fetch, globalThis.btoa);
  GhostAPI = module.exports.GhostAPI;
});

describe('GhostAPI.getAllTags()', () => {
  it('loads all blog tags with pagination', async () => {
    const api = new GhostAPI('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    const tags = await api.getAllTags();

    expect(tags).toHaveLength(2);
    expect(tags[0].name).toBe('ai');

    const url = fetch.mock.calls[0][0];
    expect(url).toContain('/tags/');
    expect(url).toContain('limit=100');
    expect(url).toContain('page=1');
  });
});

describe('GhostAPI.getTagsWithCount()', () => {
  it('loads tags with post count using pagination', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tags: [
          { id: 't1', name: 'ai', slug: 'ai', count: { posts: 5 } },
          { id: 't2', name: 'guide', slug: 'guide', count: { posts: 3 } }
        ],
        meta: { pagination: { next: null } }
      })
    });
    globalThis.fetch = mockFetch;

    // Re-import API with new fetch
    const code = (await import('fs')).readFileSync('./lib/api.js', 'utf-8');
    const module = { exports: {} };
    const fn = new Function('module', 'exports', 'chrome', 'crypto', 'fetch', 'btoa', code);
    fn(module, module.exports, globalThis.chrome, globalThis.crypto, mockFetch, globalThis.btoa);
    const API = module.exports.GhostAPI;

    const api = new API('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    const tags = await api.getTagsWithCount();

    expect(tags).toHaveLength(2);
    expect(tags[0].count.posts).toBe(5);

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('include=count.posts');
    expect(url).toContain('limit=100');
  });
});

describe('GhostAPI.createTag()', () => {
  it('creates a new tag', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tags: [{ id: 'new-tag-id', name: 'new-tag', slug: 'new-tag' }]
      })
    });
    globalThis.fetch = mockFetch;

    const code = (await import('fs')).readFileSync('./lib/api.js', 'utf-8');
    const module = { exports: {} };
    const fn = new Function('module', 'exports', 'chrome', 'crypto', 'fetch', 'btoa', code);
    fn(module, module.exports, globalThis.chrome, globalThis.crypto, mockFetch, globalThis.btoa);
    const API = module.exports.GhostAPI;

    const api = new API('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    const tag = await api.createTag({ name: 'new-tag', slug: 'new-tag' });

    expect(tag.id).toBe('new-tag-id');
    expect(tag.name).toBe('new-tag');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/tags/');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body).tags[0].name).toBe('new-tag');
  });
});

describe('GhostAPI.updateTag()', () => {
  it('updates an existing tag', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tags: [{ id: 't1', name: 'updated-tag', slug: 'updated-tag' }]
      })
    });
    globalThis.fetch = mockFetch;

    const code = (await import('fs')).readFileSync('./lib/api.js', 'utf-8');
    const module = { exports: {} };
    const fn = new Function('module', 'exports', 'chrome', 'crypto', 'fetch', 'btoa', code);
    fn(module, module.exports, globalThis.chrome, globalThis.crypto, mockFetch, globalThis.btoa);
    const API = module.exports.GhostAPI;

    const api = new API('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    const tag = await api.updateTag('t1', { name: 'updated-tag' });

    expect(tag.name).toBe('updated-tag');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/tags/t1/');
    expect(options.method).toBe('PUT');
  });
});

describe('GhostAPI.deleteTag()', () => {
  it('deletes a tag', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({})
    });
    globalThis.fetch = mockFetch;

    const code = (await import('fs')).readFileSync('./lib/api.js', 'utf-8');
    const module = { exports: {} };
    const fn = new Function('module', 'exports', 'chrome', 'crypto', 'fetch', 'btoa', code);
    fn(module, module.exports, globalThis.chrome, globalThis.crypto, mockFetch, globalThis.btoa);
    const API = module.exports.GhostAPI;

    const api = new API('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    await api.deleteTag('t1');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/tags/t1/');
    expect(options.method).toBe('DELETE');
  });
});
