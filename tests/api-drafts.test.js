import { describe, it, expect, vi, beforeEach } from 'vitest';

let GhostAPI;
beforeEach(async () => {
  const data = {
    posts: [
      { id: 'd1', title: 'Draft Post', status: 'draft', created_at: '2026-01-20T10:00:00Z', updated_at: '2026-01-20T10:00:00Z' }
    ]
  };
  globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(data));

  const code = (await import('fs')).readFileSync('./lib/api.js', 'utf-8');
  const module = { exports: {} };
  const fn = new Function('module', 'exports', 'chrome', 'crypto', 'fetch', 'btoa', code);
  fn(module, module.exports, globalThis.chrome, globalThis.crypto, globalThis.fetch, globalThis.btoa);
  GhostAPI = module.exports.GhostAPI;
});

describe('GhostAPI.getDraftPosts()', () => {
  it('fetches draft posts', async () => {
    const api = new GhostAPI('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    const drafts = await api.getDraftPosts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].status).toBe('draft');
    expect(drafts[0].title).toBe('Draft Post');
  });

  it('sends correct API filter', async () => {
    const api = new GhostAPI('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    await api.getDraftPosts();
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('status:draft');
    expect(url).toContain('order=updated_at');
  });

  it('returns empty array if no drafts', async () => {
    fetch.mockResolvedValue(createMockResponse({ posts: [] }));

    const api = new GhostAPI('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    const drafts = await api.getDraftPosts();
    expect(drafts).toEqual([]);
  });
});
