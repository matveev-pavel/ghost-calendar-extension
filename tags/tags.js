
// Application state
let tags = [];
let currentTab = 'public';
let searchQuery = '';
let editingTagId = null;
let deletingTagId = null;
let deletingTagIds = []; // For bulk delete
let selectedTags = new Set();
let api = null;

// DOM elements
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const emptyState = document.getElementById('empty-state');
const tagsList = document.getElementById('tags-list');
const errorMessage = document.getElementById('error-message');

// Initialization
async function init() {
  applyTranslations();

  try {
    await analytics.init();
    analytics.trackPageView('tags');
  } catch (e) {
    console.warn('Analytics init failed:', e);
  }

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

  // Bulk actions
  document.getElementById('select-all').addEventListener('change', (e) => {
    toggleSelectAll(e.target.checked);
  });

  document.getElementById('delete-selected-btn').addEventListener('click', () => {
    openBulkDeleteModal();
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

function getFilteredTags() {
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

  return filteredTags.sort((a, b) => a.name.localeCompare(b.name));
}

function renderTags() {
  const filteredTags = getFilteredTags();

  // Show/hide bulk actions bar
  const bulkActionsBar = document.getElementById('bulk-actions');
  bulkActionsBar.hidden = filteredTags.length === 0;

  // Update selection UI
  updateSelectionUI();

  if (filteredTags.length === 0) {
    const message = searchQuery
      ? t('noTagsMatching', [escapeHtml(searchQuery)])
      : (currentTab === 'internal' ? t('noInternalTags') : t('noPublicTags'));
    tagsList.innerHTML = `
      <div class="state empty" style="border: none;">
        <p>${message}</p>
      </div>
    `;
    return;
  }

  tagsList.innerHTML = filteredTags.map(tag => {
    const postCount = tag.count?.posts || 0;
    const isInternal = tag.name.startsWith('#');
    const isSelected = selectedTags.has(tag.id);
    const postCountText = postCount === 1 ? t('tagPostCountSingle') : t('tagPostCount', [String(postCount)]);

    return `
      <div class="tag-item${isSelected ? ' selected' : ''}" data-id="${escapeHtml(tag.id)}">
        <label class="tag-checkbox">
          <input type="checkbox" class="tag-select" ${isSelected ? 'checked' : ''}>
        </label>
        <div class="tag-info">
          <div class="tag-name${isInternal ? ' internal' : ''}">${escapeHtml(tag.name)}</div>
          <div class="tag-slug">${escapeHtml(tag.slug)}</div>
        </div>
        <div class="tag-count">${postCountText}</div>
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
  tagsList.querySelectorAll('.tag-select').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const item = e.target.closest('.tag-item');
      toggleTagSelection(item.dataset.id, e.target.checked);
    });
  });

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
  document.getElementById('modal-title').textContent = t('modalNewTag');
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
  document.getElementById('modal-title').textContent = t('modalEditTag');
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
  deletingTagIds = [];
  document.getElementById('delete-modal-title').textContent = t('modalDeleteTag');
  document.getElementById('delete-message').innerHTML =
    t('msgDeleteConfirm', [`<strong>${escapeHtml(tag.name)}</strong>`]);
  document.getElementById('delete-modal').hidden = false;
}

function closeDeleteModal() {
  document.getElementById('delete-modal').hidden = true;
  deletingTagId = null;
  deletingTagIds = [];
}

// Selection functions
function toggleTagSelection(tagId, isSelected) {
  if (isSelected) {
    selectedTags.add(tagId);
  } else {
    selectedTags.delete(tagId);
  }
  updateSelectionUI();
}

function toggleSelectAll(selectAll) {
  const filteredTags = getFilteredTags();
  if (selectAll) {
    filteredTags.forEach(tag => selectedTags.add(tag.id));
  } else {
    filteredTags.forEach(tag => selectedTags.delete(tag.id));
  }
  renderTags();
}

function updateSelectionUI() {
  const filteredTags = getFilteredTags();
  const filteredIds = new Set(filteredTags.map(t => t.id));
  const selectedInView = [...selectedTags].filter(id => filteredIds.has(id)).length;

  document.getElementById('selected-count').textContent = t('selectedCount', [String(selectedInView)]);
  document.getElementById('delete-selected-btn').disabled = selectedInView === 0;

  const selectAllCheckbox = document.getElementById('select-all');
  selectAllCheckbox.checked = filteredTags.length > 0 && selectedInView === filteredTags.length;
  selectAllCheckbox.indeterminate = selectedInView > 0 && selectedInView < filteredTags.length;
}

function openBulkDeleteModal() {
  const filteredTags = getFilteredTags();
  const filteredIds = new Set(filteredTags.map(t => t.id));
  deletingTagIds = [...selectedTags].filter(id => filteredIds.has(id));

  if (deletingTagIds.length === 0) return;

  document.getElementById('delete-modal-title').textContent = t('modalDeleteTags');
  document.getElementById('delete-message').innerHTML =
    t('msgDeleteMultipleConfirm', [`<strong>${deletingTagIds.length}</strong>`]);
  document.getElementById('delete-modal').hidden = false;
}

async function saveTag() {
  const name = document.getElementById('tag-name').value.trim();
  const slug = document.getElementById('tag-slug').value.trim();
  const description = document.getElementById('tag-description').value.trim();

  if (!name) {
    alert(t('errTagNameRequired'));
    return;
  }

  // Only include non-empty fields (Ghost will auto-generate slug if empty)
  const tagData = { name };
  if (slug) tagData.slug = slug;
  if (description) tagData.description = description;

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
      if (!created || !created.id) {
        throw new Error(t('errTagNotCreated'));
      }
      tags.push(created);
      analytics.trackTagCreate();
    }

    closeModal();
    renderTags();
  } catch (error) {
    console.error('Save error:', error);
    alert(t('errSavingTag', [error.message]));
    analytics.trackError('tag_save_error', error.message);
  }
}

async function deleteTag() {
  // Bulk delete mode
  if (deletingTagIds.length > 0) {
    try {
      const results = await api.deleteTags(deletingTagIds);

      // Remove deleted tags from local state
      tags = tags.filter(t => !results.deleted.includes(t.id));

      // Clear selection for deleted tags
      results.deleted.forEach(id => selectedTags.delete(id));

      analytics.trackTagDelete();

      closeDeleteModal();

      if (results.failed.length > 0) {
        alert(t('msgBulkDeleteResult', [String(results.deleted.length), String(results.failed.length)]));
      }

      if (tags.length === 0) {
        showState('empty');
      } else {
        renderTags();
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      alert(t('errDeletingTags', [error.message]));
      analytics.trackError('tag_bulk_delete_error', error.message);
    }
    return;
  }

  // Single delete mode
  if (!deletingTagId) return;

  try {
    await api.deleteTag(deletingTagId);
    tags = tags.filter(t => t.id !== deletingTagId);
    selectedTags.delete(deletingTagId);
    analytics.trackTagDelete();

    closeDeleteModal();

    if (tags.length === 0) {
      showState('empty');
    } else {
      renderTags();
    }
  } catch (error) {
    console.error('Delete error:', error);
    alert(t('errDeletingTag', [error.message]));
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
init().catch(err => console.error('Init failed:', err));
