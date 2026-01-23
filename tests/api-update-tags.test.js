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
