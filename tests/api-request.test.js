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
