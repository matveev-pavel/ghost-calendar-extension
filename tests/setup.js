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

// Helper to create mock Response
globalThis.createMockResponse = (data, status = 200, ok = true) => ({
  ok,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data)
});

// Mock fetch with full Response-like object
globalThis.fetch = async (url, opts) => {
  return createMockResponse({ posts: [], tags: [] });
};

// Mock btoa
if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}
