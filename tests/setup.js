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

// Мок crypto.subtle (используем defineProperty, т.к. в Node crypto — read-only getter)
Object.defineProperty(globalThis, 'crypto', {
  value: {
    subtle: {
      importKey: async () => ({}),
      sign: async () => new ArrayBuffer(32)
    }
  },
  writable: true,
  configurable: true
});

// Мок fetch
globalThis.fetch = async (url, opts) => ({
  ok: true,
  json: async () => ({ posts: [], tags: [] })
});

// Мок btoa
if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}
