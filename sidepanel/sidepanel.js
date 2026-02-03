// Application state
let posts = [];
let allTags = [];
let currentView = 'list';
let currentMonth = new Date();
let blogUrl = '';
let api = null;

// DOM elements
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const emptyState = document.getElementById('empty-state');
const listView = document.getElementById('list-view');
const calendarView = document.getElementById('calendar-view');
const postsList = document.getElementById('posts-list');
const monthTitle = document.getElementById('month-title');
const errorMessage = document.getElementById('error-message');

// Month names
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Initialization
async function init() {
  // Инициализация аналитики
  await analytics.init();
  analytics.trackPageView('sidepanel');

  setupEventListeners();
  await loadPosts();
}

// Setup event listeners
function setupEventListeners() {
  // View toggle
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });

  // Settings
  document.getElementById('open-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Retry loading
  document.getElementById('retry-btn').addEventListener('click', loadPosts);

  // Calendar navigation
  document.getElementById('prev-month').addEventListener('click', async () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    await loadMonthPosts();
    renderCalendar();
  });

  document.getElementById('next-month').addEventListener('click', async () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    await loadMonthPosts();
    renderCalendar();
  });
}

// Switch between views
function switchView(view) {
  currentView = view;

  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  listView.style.display = view === 'list' ? 'block' : 'none';
  calendarView.style.display = view === 'calendar' ? 'flex' : 'none';

  // Save preference
  chrome.storage.local.set({ preferredView: view });

  // Analytics: отслеживание переключения вида
  analytics.trackViewSwitch(view);
}

// Show state
function showState(state) {
  loadingState.style.display = state === 'loading' ? 'flex' : 'none';
  errorState.style.display = state === 'error' ? 'flex' : 'none';
  emptyState.style.display = state === 'empty' ? 'flex' : 'none';
  listView.style.display = state === 'loaded' && currentView === 'list' ? 'block' : 'none';
  calendarView.style.display = state === 'loaded' && currentView === 'calendar' ? 'flex' : 'none';
}

// Load posts
async function loadPosts() {
  showState('loading');

  try {
    api = await createAPIFromStorage();
    blogUrl = api.blogUrl;

    const [scheduled, published, tags] = await Promise.all([
      api.getScheduledPosts(),
      api.getPublishedPosts(),
      api.getAllTags()
    ]);

    // Merge and sort by date
    posts = [...published, ...scheduled].sort(
      (a, b) => new Date(a.published_at) - new Date(b.published_at)
    );
    allTags = tags;

    // Fill datalist for tag autocomplete
    const datalist = document.getElementById('tags-datalist');
    if (datalist) {
      datalist.innerHTML = allTags.map(t => `<option value="${escapeHtml(t.name)}">`).join('');
    }

    if (posts.length === 0) {
      showState('empty');
      return;
    }

    const { preferredView } = await chrome.storage.local.get(['preferredView']);
    if (preferredView) {
      currentView = preferredView;
      document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === currentView);
      });
    }

    showState('loaded');
    renderList();
    renderCalendar();
  } catch (error) {
    console.error('Loading error:', error);
    errorMessage.textContent = error.message;
    showState('error');

    // Analytics: отслеживание ошибки загрузки
    analytics.trackError('load_error', error.message);
  }
}

// Load published posts for selected month
async function loadMonthPosts() {
  if (!api) return;
  try {
    const since = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const published = await api.getPublishedPosts(since);
    // Add new posts, avoiding duplicates
    const existingIds = new Set(posts.map(p => p.id));
    const newPosts = published.filter(p => !existingIds.has(p.id));
    if (newPosts.length > 0) {
      posts = [...posts, ...newPosts].sort(
        (a, b) => new Date(a.published_at) - new Date(b.published_at)
      );
    }
  } catch (err) {
    console.error('Month loading error:', err);
  }
}

// Render list
function renderList() {
  const grouped = {};

  // Show in list: all scheduled + published for yesterday/today
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().split('T')[0];

  const listPosts = posts.filter(post =>
    post.status === 'scheduled' || post.published_at.split('T')[0] >= yesterdayKey
  );

  listPosts.forEach(post => {
    const date = new Date(post.published_at);
    const dateKey = date.toISOString().split('T')[0];

    if (!grouped[dateKey]) {
      grouped[dateKey] = { date, posts: [] };
    }
    grouped[dateKey].posts.push(post);
  });

  const sortedDates = Object.keys(grouped).sort();

  const todayKey = new Date().toISOString().split('T')[0];

  postsList.innerHTML = sortedDates.map(dateKey => {
    const group = grouped[dateKey];
    const dateStr = formatDateHeader(group.date);
    const isPast = dateKey < todayKey;

    const postsHtml = group.posts.map(post => {
      const time = formatTime(new Date(post.published_at));
      const isScheduled = post.status === 'scheduled';
      const statusClass = isScheduled ? 'status-scheduled' : 'status-published';
      const statusText = isScheduled ? 'scheduled' : 'published';
      const dragHandle = isScheduled
        ? '<div class="drag-handle" draggable="true">⠿</div>'
        : '';

      const imageHtml = post.feature_image
        ? `<img class="post-image" src="${escapeHtml(post.feature_image)}" alt="">`
        : `<div class="post-image post-image-placeholder"></div>`;

      const excerptHtml = post.custom_excerpt
        ? `<span class="post-excerpt">${escapeHtml(post.custom_excerpt)}</span>`
        : '';

      const tagsHtml = renderPostTags(post);

      return `
        <div class="post-item ${isScheduled ? 'draggable' : ''}"
             data-id="${escapeHtml(String(post.id))}"
             data-status="${escapeHtml(post.status)}"
             data-updated-at="${escapeHtml(post.updated_at)}">
          ${dragHandle}
          ${imageHtml}
          <div class="post-content">
            <span class="post-title">${escapeHtml(post.title)}</span>
            ${excerptHtml}
            <div class="post-meta">
              <span class="post-time">${time}</span>
              <span class="post-status ${statusClass}">${statusText}</span>
            </div>
            ${tagsHtml}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="date-group${isPast ? ' past' : ''}" data-date="${dateKey}">
        <div class="date-header">${dateStr}</div>
        ${postsHtml}
      </div>
    `;
  }).join('');

  // Click on post — open editor
  postsList.querySelectorAll('.post-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.drag-handle') || e.target.closest('.tag-chip') ||
          e.target.closest('.tag-add') || e.target.closest('.tag-input')) return;
      const postId = item.dataset.id;
      openEditor(postId);
    });
  });

  setupTagListeners();
  setupDragAndDrop();
}

function renderPostTags(post) {
  const tags = post.tags || [];
  const tagsChips = tags.map(tag =>
    `<span class="tag-chip" data-tag-id="${escapeHtml(tag.id)}" data-tag-name="${escapeHtml(tag.name)}">${escapeHtml(tag.name)}<span class="tag-remove">×</span></span>`
  ).join('');

  return `
    <div class="post-tags" data-post-id="${escapeHtml(String(post.id))}">
      ${tagsChips}
      <span class="tag-add" title="Add tag">+</span>
    </div>
  `;
}

function setupTagListeners() {
  // Remove tag
  postsList.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const chip = e.target.closest('.tag-chip');
      const container = e.target.closest('.post-tags');
      const postId = container.dataset.postId;
      const tagName = chip.dataset.tagName;

      const post = posts.find(p => String(p.id) === postId);
      if (!post) return;

      const newTags = (post.tags || []).filter(t => t.name !== tagName);
      try {
        const updated = await api.updatePostTags(postId, newTags);
        post.tags = updated.tags;
        post.updated_at = updated.updated_at;
        chip.remove();

        // Analytics: отслеживание удаления тега
        analytics.trackTagRemove();
      } catch (err) {
        console.error('Tag removal error:', err);
        analytics.trackError('tag_remove_error', err.message);
      }
    });
  });

  // Add tag — click on "+"
  postsList.querySelectorAll('.tag-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const container = e.target.closest('.post-tags');
      if (container.querySelector('.tag-input')) return;

      const input = document.createElement('input');
      input.className = 'tag-input';
      input.placeholder = 'tag...';
      input.setAttribute('list', 'tags-datalist');
      container.insertBefore(input, btn);
      btn.style.display = 'none';
      input.focus();

      input.addEventListener('keydown', async (ev) => {
        if (ev.key === 'Enter' && input.value.trim()) {
          const tagName = input.value.trim();
          const postId = container.dataset.postId;
          const post = posts.find(p => String(p.id) === postId);
          if (!post) return;

          const newTags = [...(post.tags || []), { name: tagName }];
          try {
            const updated = await api.updatePostTags(postId, newTags);
            post.tags = updated.tags;
            post.updated_at = updated.updated_at;
            const postEl = postsList.querySelector(`[data-id="${postId}"]`);
            const tagsContainer = postEl.querySelector('.post-tags');
            tagsContainer.outerHTML = renderPostTags(post);
            setupTagListeners();

            // Analytics: отслеживание добавления тега
            analytics.trackTagAdd();
          } catch (err) {
            console.error('Tag addition error:', err);
            analytics.trackError('tag_add_error', err.message);
          }
        } else if (ev.key === 'Escape') {
          input.remove();
          btn.style.display = '';
        }
      });

      input.addEventListener('blur', () => {
        setTimeout(() => {
          if (container.contains(input)) {
            input.remove();
            btn.style.display = '';
          }
        }, 150);
      });
    });
  });
}

function setupDragAndDrop() {
  let draggedPostId = null;

  postsList.querySelectorAll('.post-item.draggable').forEach(item => {
    const handle = item.querySelector('.drag-handle');
    if (!handle) return;

    handle.addEventListener('dragstart', (e) => {
      draggedPostId = item.dataset.id;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.id);
    });

    handle.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      document.querySelectorAll('.date-group.drag-over').forEach(z => z.classList.remove('drag-over'));
      draggedPostId = null;
    });
  });

  // Drop zones — date groups
  postsList.querySelectorAll('.date-group').forEach(group => {
    group.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      group.classList.add('drag-over');
    });

    group.addEventListener('dragleave', () => {
      group.classList.remove('drag-over');
    });

    group.addEventListener('drop', async (e) => {
      e.preventDefault();
      group.classList.remove('drag-over');

      const postId = e.dataTransfer.getData('text/plain');
      const targetDate = group.dataset.date;
      if (!postId || !targetDate) return;

      const post = posts.find(p => String(p.id) === postId);
      if (!post) return;

      // Keep time, change only date
      const oldDate = new Date(post.published_at);
      const [year, mon, day] = targetDate.split('-').map(Number);
      const newDate = new Date(year, mon - 1, day, oldDate.getHours(), oldDate.getMinutes(), oldDate.getSeconds());

      try {
        const updated = await api.updatePostDate(postId, newDate.toISOString());
        post.published_at = updated.published_at;
        post.updated_at = updated.updated_at;
        posts.sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
        renderList();
        renderCalendar();

        // Analytics: отслеживание drag & drop
        analytics.trackDragDrop();
      } catch (err) {
        console.error('Date update error:', err);
        analytics.trackError('drag_drop_error', err.message);
      }
    });
  });
}

// Render calendar
function renderCalendar() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const timeline = document.getElementById('timeline');

  monthTitle.textContent = `${monthNames[month]} ${year}`;

  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Group posts by days of this month
  const postsByDay = {};
  posts.forEach(post => {
    const date = new Date(post.published_at);
    if (date.getMonth() === month && date.getFullYear() === year) {
      const day = date.getDate();
      if (!postsByDay[day]) postsByDay[day] = [];
      postsByDay[day].push(post);
    }
  });

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let html = '';
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    const dayName = dayNames[date.getDay()];
    const dayPosts = postsByDay[day] || [];
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    let label = '';
    if (isToday) label = ' (today)';
    else if (isYesterday) label = ' (yesterday)';

    const isPast = date.toDateString() !== today.toDateString() && date < today;
    const dayClass = `timeline-day${isToday ? ' timeline-today' : ''}${isPast ? ' timeline-past' : ''}${dayPosts.length > 0 ? ' has-posts' : ''}`;

    const postsHtml = dayPosts.map(post => {
      const time = formatTime(new Date(post.published_at));
      const isScheduled = post.status === 'scheduled';
      const statusIcon = isScheduled ? '○' : '●';
      const statusClass = isScheduled ? 'status-scheduled' : 'status-published';

      return `
        <div class="timeline-post ${isScheduled ? 'draggable' : ''}"
             data-id="${escapeHtml(String(post.id))}"
             data-status="${escapeHtml(post.status)}"
             data-updated-at="${escapeHtml(post.updated_at)}"
             ${isScheduled ? 'draggable="true"' : ''}>
          <span class="timeline-post-time">${time}</span>
          <span class="timeline-post-status ${statusClass}">${statusIcon}</span>
          <span class="timeline-post-title">${escapeHtml(post.title)}</span>
        </div>
      `;
    }).join('');

    html += `
      <div class="${dayClass}" data-date="${date.toISOString().split('T')[0]}">
        <div class="timeline-day-header">
          <span class="timeline-day-name">${dayName} ${day}${label}</span>
        </div>
        <div class="timeline-day-posts">
          ${postsHtml || '<div class="timeline-empty"></div>'}
        </div>
      </div>
    `;
  }

  timeline.innerHTML = html;

  // Click on post — open editor
  timeline.querySelectorAll('.timeline-post').forEach(item => {
    item.addEventListener('click', () => {
      openEditor(item.dataset.id);
    });
  });

  // Drag & drop in timeline
  setupTimelineDragAndDrop();

  // Scroll to today
  const todayEl = timeline.querySelector('.timeline-today');
  if (todayEl) {
    todayEl.scrollIntoView({ block: 'center' });
  }
}

function setupTimelineDragAndDrop() {
  const timeline = document.getElementById('timeline');

  timeline.querySelectorAll('.timeline-post.draggable').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.id);
      item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      timeline.querySelectorAll('.timeline-day.drag-over').forEach(d => d.classList.remove('drag-over'));
    });
  });

  timeline.querySelectorAll('.timeline-day').forEach(day => {
    day.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      day.classList.add('drag-over');
    });

    day.addEventListener('dragleave', () => {
      day.classList.remove('drag-over');
    });

    day.addEventListener('drop', async (e) => {
      e.preventDefault();
      day.classList.remove('drag-over');

      const postId = e.dataTransfer.getData('text/plain');
      const targetDate = day.dataset.date;
      if (!postId || !targetDate) return;

      const post = posts.find(p => String(p.id) === postId);
      if (!post) return;

      const oldDate = new Date(post.published_at);
      const [year, mon, day] = targetDate.split('-').map(Number);
      const newDate = new Date(year, mon - 1, day, oldDate.getHours(), oldDate.getMinutes(), oldDate.getSeconds());

      try {
        const updated = await api.updatePostDate(postId, newDate.toISOString());
        post.published_at = updated.published_at;
        post.updated_at = updated.updated_at;
        posts.sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
        renderCalendar();
        renderList();

        // Analytics: отслеживание drag & drop в timeline
        analytics.trackDragDrop();
      } catch (err) {
        console.error('Date update error:', err);
        analytics.trackError('drag_drop_error', err.message);
      }
    });
  });
}

// Open post editor
function openEditor(postId) {
  if (!postId || !/^[a-f0-9]{24}$/.test(postId)) return;
  const url = `${blogUrl}/ghost/#/editor/post/${postId}`;
  chrome.tabs.create({ url });

  // Analytics: отслеживание открытия поста
  analytics.trackPostOpen();
}

// Format date for header
function formatDateHeader(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateStr = date.toDateString();
  if (dateStr === yesterday.toDateString()) return 'Yesterday';
  if (dateStr === today.toDateString()) return 'Today';
  if (dateStr === tomorrow.toDateString()) return 'Tomorrow';

  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  return date.toLocaleDateString('en-US', options);
}

// Format time
function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// Escape HTML
function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

// Start
init();
