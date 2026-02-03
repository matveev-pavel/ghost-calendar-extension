// Open Side Panel on extension icon click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Override Origin header for PUT requests to Ghost API
// Ghost checks Origin on mutating requests (CSRF protection)
const RULE_ID = 1;

async function updateOriginRule() {
  const { blogUrl } = await chrome.storage.local.get(['blogUrl']);

  // Remove old rule
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID]
  });

  if (!blogUrl) return;

  const origin = blogUrl.replace(/\/$/, '');
  const urlFilter = `${origin}/ghost/api/*`;

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [{
      id: RULE_ID,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{
          header: 'Origin',
          operation: 'set',
          value: origin
        }]
      },
      condition: {
        urlFilter,
        resourceTypes: ['xmlhttprequest']
      }
    }]
  });
}

// Migrate settings from sync to local (v1 → v2) и инициализация analytics client_id
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'update') {
    const sync = await chrome.storage.sync.get(['blogUrl', 'apiKey']);
    if (sync.blogUrl) {
      await chrome.storage.local.set(sync);
      await chrome.storage.sync.remove(['blogUrl', 'apiKey']);
    }
  }

  // Генерация client_id для аналитики при первой установке
  if (details.reason === 'install') {
    const clientId = `${Date.now()}.${Math.random().toString(36).substring(2, 15)}`;
    await chrome.storage.local.set({ analyticsClientId: clientId });
  }

  updateOriginRule();
});

// Initialize on startup
updateOriginRule();

// Update on settings change
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.blogUrl) {
    updateOriginRule();
  }
});
