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
  it('calls API with published filter and date from yesterday', async () => {
    const api = new GhostAPI('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    const posts = await api.getPublishedPosts();

    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe('Published Post');

    const url = decodeURIComponent(fetch.mock.calls[0][0]);
    expect(url).toContain('status:published');
    expect(url).toContain('published_at');
    expect(url).toContain('include=tags');
    expect(url).toContain('fields=');
  });

  it('returns empty array if no posts', async () => {
    fetch.mockResolvedValue({
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
