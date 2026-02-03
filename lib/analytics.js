/**
 * Google Analytics 4 Measurement Protocol
 * Для использования в Chrome Extensions (Manifest V3)
 */

const GA_MEASUREMENT_ID = 'G-RL8MWEPJ4J';
const GA_API_SECRET = 'NO4RH1ypRyOFvBXH7AnxNw';

class Analytics {
  constructor() {
    this.measurementId = GA_MEASUREMENT_ID;
    this.apiSecret = GA_API_SECRET;
    this.clientId = null;
    this.enabled = true;
  }

  /**
   * Инициализация — получение или создание client_id
   */
  async init() {
    try {
      const { analyticsClientId } = await chrome.storage.local.get(['analyticsClientId']);

      if (analyticsClientId) {
        this.clientId = analyticsClientId;
      } else {
        // Генерируем новый client_id (формат GA4)
        this.clientId = `${Date.now()}.${Math.random().toString(36).substring(2, 15)}`;
        await chrome.storage.local.set({ analyticsClientId: this.clientId });
      }
    } catch (e) {
      console.warn('Analytics init error:', e);
      this.enabled = false;
    }
  }

  /**
   * Отправка события в GA4
   */
  async sendEvent(eventName, params = {}) {
    if (!this.enabled || !this.clientId || !this.apiSecret) {
      return;
    }

    const payload = {
      client_id: this.clientId,
      events: [{
        name: eventName,
        params: {
          engagement_time_msec: '100',
          ...params
        }
      }]
    };

    try {
      const url = `https://www.google-analytics.com/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`;

      await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('Analytics event error:', e);
    }
  }

  /**
   * Отслеживание просмотра страницы
   */
  async trackPageView(pageName) {
    await this.sendEvent('page_view', {
      page_title: pageName,
      page_location: `chrome-extension://${pageName}`
    });
  }

  /**
   * Отслеживание переключения вида (list/calendar)
   */
  async trackViewSwitch(viewType) {
    await this.sendEvent('view_switch', {
      view_type: viewType
    });
  }

  /**
   * Отслеживание drag & drop
   */
  async trackDragDrop() {
    await this.sendEvent('drag_drop');
  }

  /**
   * Отслеживание добавления тега
   */
  async trackTagAdd() {
    await this.sendEvent('tag_add');
  }

  /**
   * Отслеживание удаления тега
   */
  async trackTagRemove() {
    await this.sendEvent('tag_remove');
  }

  /**
   * Отслеживание открытия поста
   */
  async trackPostOpen() {
    await this.sendEvent('post_open');
  }

  /**
   * Отслеживание сохранения настроек
   */
  async trackSettingsSave() {
    await this.sendEvent('settings_save');
  }

  /**
   * Отслеживание открытия страницы обратной связи
   */
  async trackFeedbackOpen() {
    await this.sendEvent('feedback_open');
  }

  /**
   * Отслеживание тестирования соединения
   */
  async trackConnectionTest(success) {
    await this.sendEvent('connection_test', {
      success: success.toString()
    });
  }

  /**
   * Отслеживание ошибок
   */
  async trackError(errorType, errorMessage) {
    await this.sendEvent('error', {
      error_type: errorType,
      error_message: errorMessage.substring(0, 100) // Ограничиваем длину
    });
  }
}

// Singleton instance
const analytics = new Analytics();
