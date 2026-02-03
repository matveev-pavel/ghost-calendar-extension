// Application state
let tags = [];
let currentTab = 'public';
let searchQuery = '';
let editingTagId = null;
let deletingTagId = null;
let api = null;

// DOM elements
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const emptyState = document.getElementById('empty-state');
const tagsList = document.getElementById('tags-list');
const errorMessage = document.getElementById('error-message');

// Initialization
async function init() {
  await analytics.init();
  analytics.trackPageView('tags');

  setupEventListeners();
  await loadTags();
}

function setupEventListeners() {
  // Back button
  document.getElementById('back-btn').addEventListener('click', () => {
    window.close();
  });

  // New tag button
  document.getElementById('new-tag-btn').addEventListener('click', () => {
    openCreateModal();
  });

  // Create first tag (empty state)
  document.getElementById('create-first-tag').addEventListener('click', () => {
    openCreateModal();
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Retry button
  document.getElementById('retry-btn').addEventListener('click', loadTags);

  // Search
  document.getElementById('tag-search').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderTags();
  });

  // Modal events
  setupModalListeners();
}

function setupModalListeners() {
  const modal = document.getElementById('modal-overlay');
  const deleteModal = document.getElementById('delete-modal');

  // Close modal buttons
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('delete-modal-close').addEventListener('click', closeDeleteModal);
  document.getElementById('delete-cancel').addEventListener('click', closeDeleteModal);

  // Save tag
  document.getElementById('modal-save').addEventListener('click', saveTag);

  // Delete tag
  document.getElementById('delete-confirm').addEventListener('click', deleteTag);

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });

  // Auto-generate slug from name
  document.getElementById('tag-name').addEventListener('input', (e) => {
    if (!editingTagId) {
      const slug = generateSlug(e.target.value);
      document.getElementById('tag-slug').value = slug;
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeDeleteModal();
    }
  });
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function showState(state) {
  loadingState.style.display = state === 'loading' ? 'flex' : 'none';
  errorState.style.display = state === 'error' ? 'flex' : 'none';
  emptyState.style.display = state === 'empty' ? 'flex' : 'none';
  tagsList.style.display = state === 'loaded' ? 'block' : 'none';
}

async function loadTags() {
  showState('loading');

  try {
    api = await createAPIFromStorage();
    tags = await api.getTagsWithCount();

    if (tags.length === 0) {
      showState('empty');
      return;
    }

    showState('loaded');
    renderTags();
  } catch (error) {
    console.error('Loading error:', error);
    errorMessage.textContent = error.message;
    showState('error');
    analytics.trackError('tags_load_error', error.message);
  }
}

function switchTab(tab) {
  currentTab = tab;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  renderTags();
}

function renderTags() {
  let filteredTags = tags.filter(tag => {
    const isInternal = tag.name.startsWith('#');
    return currentTab === 'internal' ? isInternal : !isInternal;
  });

  // Apply search filter
  if (searchQuery) {
    filteredTags = filteredTags.filter(tag =>
      tag.name.toLowerCase().includes(searchQuery) ||
      (tag.slug && tag.slug.toLowerCase().includes(searchQuery))
    );
  }

  if (filteredTags.length === 0) {
    const message = searchQuery
      ? `No tags matching "${escapeHtml(searchQuery)}"`
      : `No ${currentTab === 'internal' ? 'internal' : 'public'} tags found`;
    tagsList.innerHTML = `
      <div class="state empty" style="border: none;">
        <p>${message}</p>
      </div>
    `;
    return;
  }

  // Sort alphabetically
  filteredTags.sort((a, b) => a.name.localeCompare(b.name));

  tagsList.innerHTML = filteredTags.map(tag => {
    const postCount = tag.count?.posts || 0;
    const isInternal = tag.name.startsWith('#');

    return `
      <div class="tag-item" data-id="${escapeHtml(tag.id)}">
        <div class="tag-info">
          <div class="tag-name${isInternal ? ' internal' : ''}">${escapeHtml(tag.name)}</div>
          <div class="tag-slug">${escapeHtml(tag.slug)}</div>
        </div>
        <div class="tag-count">${postCount} ${postCount === 1 ? 'post' : 'posts'}</div>
        <div class="tag-actions">
          <button class="action-btn edit-btn" title="Edit">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.146.146a.5.5 0 01.708 0l3 3a.5.5 0 010 .708l-10 10a.5.5 0 01-.168.11l-5 2a.5.5 0 01-.65-.65l2-5a.5.5 0 01.11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 01.5.5v.5h.5a.5.5 0 01.5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 015 12.5V12h-.5a.5.5 0 01-.5-.5V11h-.5a.5.5 0 01-.468-.325z"/>
            </svg>
          </button>
          <button class="action-btn delete delete-btn" title="Delete">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
              <path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners
  tagsList.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const item = e.target.closest('.tag-item');
      openEditModal(item.dataset.id);
    });
  });

  tagsList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const item = e.target.closest('.tag-item');
      openDeleteModal(item.dataset.id);
    });
  });
}

function openCreateModal() {
  editingTagId = null;
  document.getElementById('modal-title').textContent = 'New Tag';
  document.getElementById('tag-name').value = '';
  document.getElementById('tag-slug').value = '';
  document.getElementById('tag-description').value = '';
  document.getElementById('modal-overlay').hidden = false;
  document.getElementById('tag-name').focus();
}

function openEditModal(tagId) {
  const tag = tags.find(t => t.id === tagId);
  if (!tag) return;

  editingTagId = tagId;
  document.getElementById('modal-title').textContent = 'Edit Tag';
  document.getElementById('tag-name').value = tag.name;
  document.getElementById('tag-slug').value = tag.slug;
  document.getElementById('tag-description').value = tag.description || '';
  document.getElementById('modal-overlay').hidden = false;
  document.getElementById('tag-name').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
  editingTagId = null;
}

function openDeleteModal(tagId) {
  const tag = tags.find(t => t.id === tagId);
  if (!tag) return;

  deletingTagId = tagId;
  document.getElementById('delete-tag-name').textContent = tag.name;
  document.getElementById('delete-modal').hidden = false;
}

function closeDeleteModal() {
  document.getElementById('delete-modal').hidden = true;
  deletingTagId = null;
}

async function saveTag() {
  const name = document.getElementById('tag-name').value.trim();
  const slug = document.getElementById('tag-slug').value.trim();
  const description = document.getElementById('tag-description').value.trim();

  if (!name) {
    alert('Tag name is required');
    return;
  }

  const tagData = { name, slug, description };

  try {
    if (editingTagId) {
      const updated = await api.updateTag(editingTagId, tagData);
      const index = tags.findIndex(t => t.id === editingTagId);
      if (index >= 0) {
        tags[index] = { ...tags[index], ...updated };
      }
      analytics.trackTagUpdate();
    } else {
      const created = await api.createTag(tagData);
      tags.push(created);
      analytics.trackTagCreate();
    }

    closeModal();
    renderTags();
  } catch (error) {
    console.error('Save error:', error);
    alert('Error saving tag: ' + error.message);
    analytics.trackError('tag_save_error', error.message);
  }
}

async function deleteTag() {
  if (!deletingTagId) return;

  try {
    await api.deleteTag(deletingTagId);
    tags = tags.filter(t => t.id !== deletingTagId);
    analytics.trackTagDelete();

    closeDeleteModal();

    if (tags.length === 0) {
      showState('empty');
    } else {
      renderTags();
    }
  } catch (error) {
    console.error('Delete error:', error);
    alert('Error deleting tag: ' + error.message);
    analytics.trackError('tag_delete_error', error.message);
  }
}

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

// Start
init();
