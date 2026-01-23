// Открывать Side Panel при клике на иконку расширения
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Подмена Origin заголовка для PUT-запросов к Ghost API
// Ghost проверяет Origin на мутирующих запросах (CSRF-защита)
const RULE_ID = 1;

async function updateOriginRule() {
  const { blogUrl } = await chrome.storage.local.get(['blogUrl']);

  // Удаляем старое правило
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

// Миграция настроек из sync в local (v1 → v2)
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'update') {
    const sync = await chrome.storage.sync.get(['blogUrl', 'apiKey']);
    if (sync.blogUrl) {
      await chrome.storage.local.set(sync);
      await chrome.storage.sync.remove(['blogUrl', 'apiKey']);
    }
  }
  updateOriginRule();
});

// Инициализация при старте
updateOriginRule();

// Обновление при смене настроек
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.blogUrl) {
    updateOriginRule();
  }
});
