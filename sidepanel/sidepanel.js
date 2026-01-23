// Состояние приложения
let posts = [];
let allTags = [];
let currentView = 'list';
let currentMonth = new Date();
let blogUrl = '';
let api = null;

// DOM элементы
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const emptyState = document.getElementById('empty-state');
const listView = document.getElementById('list-view');
const calendarView = document.getElementById('calendar-view');
const postsList = document.getElementById('posts-list');
const monthTitle = document.getElementById('month-title');
const errorMessage = document.getElementById('error-message');

// Названия месяцев
const monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

// Инициализация
async function init() {
  setupEventListeners();
  await loadPosts();
}

// Настройка обработчиков событий
function setupEventListeners() {
  // Переключение вида
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });

  // Настройки
  document.getElementById('open-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Повтор загрузки
  document.getElementById('retry-btn').addEventListener('click', loadPosts);

  // Навигация по календарю
  document.getElementById('prev-month').addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById('next-month').addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderCalendar();
  });
}

// Переключение между видами
function switchView(view) {
  currentView = view;

  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  listView.style.display = view === 'list' ? 'block' : 'none';
  calendarView.style.display = view === 'calendar' ? 'flex' : 'none';

  // Сохраняем выбор
  chrome.storage.local.set({ preferredView: view });
}

// Показ состояния
function showState(state) {
  loadingState.style.display = state === 'loading' ? 'flex' : 'none';
  errorState.style.display = state === 'error' ? 'flex' : 'none';
  emptyState.style.display = state === 'empty' ? 'flex' : 'none';
  listView.style.display = state === 'loaded' && currentView === 'list' ? 'block' : 'none';
  calendarView.style.display = state === 'loaded' && currentView === 'calendar' ? 'flex' : 'none';
}

// Загрузка постов
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

    // Объединяем и сортируем по дате
    posts = [...published, ...scheduled].sort(
      (a, b) => new Date(a.published_at) - new Date(b.published_at)
    );
    allTags = tags;

    // Заполнить datalist для автодополнения тегов
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
    console.error('Ошибка загрузки:', error);
    errorMessage.textContent = error.message;
    showState('error');
  }
}

// Рендер списка
function renderList() {
  const grouped = {};

  posts.forEach(post => {
    const date = new Date(post.published_at);
    const dateKey = date.toISOString().split('T')[0];

    if (!grouped[dateKey]) {
      grouped[dateKey] = { date, posts: [] };
    }
    grouped[dateKey].posts.push(post);
  });

  const sortedDates = Object.keys(grouped).sort();

  postsList.innerHTML = sortedDates.map(dateKey => {
    const group = grouped[dateKey];
    const dateStr = formatDateHeader(group.date);

    const postsHtml = group.posts.map(post => {
      const time = formatTime(new Date(post.published_at));
      const isScheduled = post.status === 'scheduled';
      const statusClass = isScheduled ? 'status-scheduled' : 'status-published';
      const statusText = isScheduled ? 'запланирован' : 'опубликован';
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
             data-status="${post.status}"
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
      <div class="date-group" data-date="${dateKey}">
        <div class="date-header">${dateStr}</div>
        ${postsHtml}
      </div>
    `;
  }).join('');

  // Клик на пост — открыть редактор
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
      <span class="tag-add" title="Добавить тег">+</span>
    </div>
  `;
}

function setupTagListeners() {
  // Удаление тега
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
        const updated = await api.updatePostTags(postId, newTags, post.updated_at);
        post.tags = updated.tags;
        post.updated_at = updated.updated_at;
        chip.remove();
      } catch (err) {
        console.error('Ошибка удаления тега:', err);
      }
    });
  });

  // Добавление тега — клик на "+"
  postsList.querySelectorAll('.tag-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const container = e.target.closest('.post-tags');
      if (container.querySelector('.tag-input')) return;

      const input = document.createElement('input');
      input.className = 'tag-input';
      input.placeholder = 'тег...';
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
            const updated = await api.updatePostTags(postId, newTags, post.updated_at);
            post.tags = updated.tags;
            post.updated_at = updated.updated_at;
            const postEl = postsList.querySelector(`[data-id="${postId}"]`);
            const tagsContainer = postEl.querySelector('.post-tags');
            tagsContainer.outerHTML = renderPostTags(post);
            setupTagListeners();
          } catch (err) {
            console.error('Ошибка добавления тега:', err);
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

  // Дропзоны — группы дат
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

      // Сохраняем время, меняем только дату
      const oldDate = new Date(post.published_at);
      const newDate = new Date(targetDate);
      newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), oldDate.getSeconds());

      try {
        const updated = await api.updatePostDate(postId, newDate.toISOString(), post.updated_at);
        post.published_at = updated.published_at;
        post.updated_at = updated.updated_at;
        posts.sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
        renderList();
        renderCalendar();
      } catch (err) {
        console.error('Ошибка обновления даты:', err);
      }
    });
  });
}

// Рендер календаря
function renderCalendar() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  monthTitle.textContent = `${monthNames[month]} ${year}`;

  // Первый день месяца
  const firstDay = new Date(year, month, 1);
  // Последний день месяца
  const lastDay = new Date(year, month + 1, 0);
  // День недели первого дня (0 = Вс, нужно сделать 0 = Пн)
  let startWeekday = firstDay.getDay() - 1;
  if (startWeekday < 0) startWeekday = 6;

  // Создаём карту постов по дням
  const postsByDay = {};
  posts.forEach(post => {
    const date = new Date(post.published_at);
    if (date.getMonth() === month && date.getFullYear() === year) {
      const day = date.getDate();
      if (!postsByDay[day]) postsByDay[day] = [];
      postsByDay[day].push(post);
    }
  });

  // Сегодняшняя дата
  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
  const todayDate = today.getDate();

  let html = '';

  // Пустые ячейки до начала месяца
  for (let i = 0; i < startWeekday; i++) {
    const prevMonth = new Date(year, month, 0);
    const day = prevMonth.getDate() - startWeekday + i + 1;
    html += `<div class="day other-month"><span class="day-number">${day}</span></div>`;
  }

  // Дни месяца
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dayPosts = postsByDay[day] || [];
    const hasPosts = dayPosts.length > 0;
    const isToday = isCurrentMonth && day === todayDate;

    let classes = 'day';
    if (isToday) classes += ' today';
    if (hasPosts) classes += ' has-posts';

    const dotsHtml = dayPosts.slice(0, 4).map(() => '<span class="dot"></span>').join('');

    html += `
      <div class="${classes}" data-day="${day}">
        <span class="day-number">${day}</span>
        ${hasPosts ? `<div class="day-dots">${dotsHtml}</div>` : ''}
      </div>
    `;
  }

  // Пустые ячейки после конца месяца
  const totalCells = startWeekday + lastDay.getDate();
  const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remainingCells; i++) {
    html += `<div class="day other-month"><span class="day-number">${i}</span></div>`;
  }

  calendarDays.innerHTML = html;

  // События на дни с постами
  calendarDays.querySelectorAll('.day.has-posts').forEach(dayEl => {
    const day = parseInt(dayEl.dataset.day);
    const dayPosts = postsByDay[day];

    // Hover для tooltip
    dayEl.addEventListener('mouseenter', (e) => {
      showTooltip(e, dayPosts);
    });

    dayEl.addEventListener('mouseleave', () => {
      hideTooltip();
    });

    dayEl.addEventListener('mousemove', (e) => {
      updateTooltipPosition(e);
    });

    // Клик открывает первый пост
    dayEl.addEventListener('click', () => {
      if (dayPosts.length === 1) {
        openEditor(dayPosts[0].id);
      } else {
        // Показываем список постов этого дня
        switchView('list');
        // Скроллим к нужной дате
        const dateKey = new Date(year, month, day).toISOString().split('T')[0];
        // Ищем группу
        setTimeout(() => {
          const group = postsList.querySelector(`[data-date="${dateKey}"]`);
          if (group) group.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    });
  });
}

// Показать tooltip
function showTooltip(e, dayPosts) {
  const content = dayPosts.map(post => {
    const time = formatTime(new Date(post.published_at));
    return `<div class="tooltip-item">
      <div class="tooltip-title">${escapeHtml(post.title)}</div>
      <div class="tooltip-time">${time}</div>
    </div>`;
  }).join('');

  tooltip.innerHTML = content;
  tooltip.classList.add('visible');
  updateTooltipPosition(e);
}

// Обновить позицию tooltip
function updateTooltipPosition(e) {
  const x = e.clientX + 10;
  const y = e.clientY + 10;

  // Проверяем, не выходит ли за границы
  const rect = tooltip.getBoundingClientRect();
  const maxX = window.innerWidth - rect.width - 10;
  const maxY = window.innerHeight - rect.height - 10;

  tooltip.style.left = `${Math.min(x, maxX)}px`;
  tooltip.style.top = `${Math.min(y, maxY)}px`;
}

// Скрыть tooltip
function hideTooltip() {
  tooltip.classList.remove('visible');
}

// Открыть редактор поста
function openEditor(postId) {
  const url = `${blogUrl}/ghost/#/editor/post/${postId}`;
  chrome.tabs.create({ url });
}

// Форматирование даты для заголовка
function formatDateHeader(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateStr = date.toDateString();
  if (dateStr === yesterday.toDateString()) return 'Вчера';
  if (dateStr === today.toDateString()) return 'Сегодня';
  if (dateStr === tomorrow.toDateString()) return 'Завтра';

  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  return date.toLocaleDateString('ru-RU', options);
}

// Форматирование времени
function formatTime(date) {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// Экранирование HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Запуск
init();
