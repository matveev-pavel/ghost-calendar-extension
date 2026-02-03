import { describe, it, expect, vi, beforeEach } from 'vitest';

let GhostAPI;
beforeEach(async () => {
  globalThis.fetch = vi.fn()
    // GET updated_at
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        posts: [{ id: 'post-1', updated_at: '2026-01-23T09:00:00Z' }]
      })
    })
    // PUT
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        posts: [{
          id: 'post-1',
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
  it('gets updated_at and sends PUT with tags array', async () => {
    const api = new GhostAPI('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    const tags = [{ id: 't1', name: 'ai' }, { id: 't2', name: 'guide' }];
    const result = await api.updatePostTags('post-1', tags);

    expect(result.tags).toHaveLength(2);

    // GET updated_at
    const [getUrl] = fetch.mock.calls[0];
    expect(getUrl).toContain('/posts/post-1/?fields=id,updated_at');

    // PUT
    const [, opts] = fetch.mock.calls[1];
    expect(opts.method).toBe('PUT');
    const body = JSON.parse(opts.body);
    expect(body.posts[0].tags).toEqual(tags);
    expect(body.posts[0].updated_at).toBe('2026-01-23T09:00:00Z');
  });

  it('converts string tags to objects with name', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [{ id: 'post-1', updated_at: '2026-01-23T09:00:00Z' }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [{ id: 'post-1', tags: [{ name: 'ai' }, { name: 'guide' }], updated_at: '2026-01-23T12:00:00Z' }]
        })
      });

    const code = (await import('fs')).readFileSync('./lib/api.js', 'utf-8');
    const mod = { exports: {} };
    const fn = new Function('module', 'exports', 'chrome', 'crypto', 'fetch', 'btoa', code);
    fn(mod, mod.exports, globalThis.chrome, globalThis.crypto, mockFetch, globalThis.btoa);
    const API = mod.exports.GhostAPI;

    const api = new API('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    await api.updatePostTags('post-1', ['ai', 'guide']);

    const [, opts] = mockFetch.mock.calls[1];
    const body = JSON.parse(opts.body);
    expect(body.posts[0].tags).toEqual([{ name: 'ai' }, { name: 'guide' }]);
  });
});
