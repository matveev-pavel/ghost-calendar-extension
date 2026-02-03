// Mock chrome.storage
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

// Mock crypto.subtle (using defineProperty since crypto is a read-only getter in Node)
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

// Mock fetch
globalThis.fetch = async (url, opts) => ({
  ok: true,
  json: async () => ({ posts: [], tags: [] })
});

// Mock btoa
if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}
