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
