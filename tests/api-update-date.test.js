import { describe, it, expect, vi, beforeEach } from 'vitest';

let GhostAPI;
beforeEach(async () => {
  globalThis.fetch = vi.fn()
    // Первый вызов — GET updated_at
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        posts: [{ id: 'post-1', updated_at: '2026-01-23T09:00:00Z' }]
      })
    })
    // Второй вызов — PUT
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        posts: [{
          id: 'post-1',
          published_at: '2026-01-25T10:00:00Z',
          updated_at: '2026-01-25T10:00:01Z'
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
  it('получает актуальный updated_at и отправляет PUT с published_at', async () => {
    const api = new GhostAPI('https://blog.example.com', 'id123:aabbccdd');
    api.token = 'fake-token';
    api.tokenExp = Math.floor(Date.now() / 1000) + 300;

    const result = await api.updatePostDate('post-1', '2026-01-25T10:00:00Z');

    expect(result.published_at).toBe('2026-01-25T10:00:00Z');

    // Первый запрос — GET updated_at
    const [getUrl] = fetch.mock.calls[0];
    expect(getUrl).toContain('/posts/post-1/?fields=id,updated_at');

    // Второй запрос — PUT
    const [putUrl, opts] = fetch.mock.calls[1];
    expect(putUrl).toContain('/posts/post-1/');
    expect(opts.method).toBe('PUT');
    const body = JSON.parse(opts.body);
    expect(body.posts[0].published_at).toBe('2026-01-25T10:00:00Z');
    expect(body.posts[0].updated_at).toBe('2026-01-23T09:00:00Z');
  });
});
