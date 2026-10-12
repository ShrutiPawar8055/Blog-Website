// State Management
let currentUserId = 1;
let articlesData = [];

// DOM Elements
const articlesGrid = document.getElementById('articles-grid');
const articleCountEl = document.getElementById('article-count');
const currentUserSelect = document.getElementById('current-user-select');

const filterTagInput = document.getElementById('filter-tag');
const filterDateInput = document.getElementById('filter-date');
const btnApplyFilters = document.getElementById('btn-apply-filters');
const btnResetFilters = document.getElementById('btn-reset-filters');

const articleModal = document.getElementById('article-modal');
const articleForm = document.getElementById('article-form');
const btnOpenCreateModal = document.getElementById('btn-open-create-modal');
const btnCloseArticleModal = document.getElementById('close-article-modal');
const btnCancelArticleModal = document.getElementById('cancel-article-modal');

const userModal = document.getElementById('user-modal');
const userForm = document.getElementById('user-form');
const btnOpenUserModal = document.getElementById('btn-open-user-modal');
const btnCloseUserModal = document.getElementById('close-user-modal');
const btnCancelUserModal = document.getElementById('cancel-user-modal');

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  loadUsers();
  loadArticles();
  setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
  currentUserSelect.addEventListener('change', (e) => {
    currentUserId = parseInt(e.target.value, 10);
  });

  btnApplyFilters.addEventListener('click', applyFilters);
  btnResetFilters.addEventListener('click', resetFilters);

  // Article Modal Events
  btnOpenCreateModal.addEventListener('click', () => openArticleModal());
  btnCloseArticleModal.addEventListener('click', closeArticleModal);
  btnCancelArticleModal.addEventListener('click', closeArticleModal);
  articleForm.addEventListener('submit', handleSaveArticle);

  // User Modal Events
  btnOpenUserModal.addEventListener('click', () => userModal.classList.add('active'));
  btnCloseUserModal.addEventListener('click', () => userModal.classList.remove('active'));
  btnCancelUserModal.addEventListener('click', () => userModal.classList.remove('active'));
  userForm.addEventListener('submit', handleCreateUser);
}

// Fetch and populate active user dropdown
async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    const result = await res.json();
    if (result.success && result.data) {
      currentUserSelect.innerHTML = result.data
        .map(u => `<option value="${u.id}">${u.username} (ID: ${u.id})</option>`)
        .join('');
      if (result.data.length > 0) {
        currentUserId = result.data[0].id;
      }
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

// Fetch articles with optional tag & date filters
async function loadArticles(filters = {}) {
  articlesGrid.innerHTML = '<div class="loading-spinner">Loading articles from MySQL...</div>';
  try {
    const params = new URLSearchParams();
    if (filters.tag) params.append('tag', filters.tag);
    if (filters.date) params.append('date', filters.date);

    const url = `/api/articles${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url);
    const result = await res.json();

    if (result.success) {
      articlesData = result.data;
      renderArticles(articlesData);
    } else {
      articlesGrid.innerHTML = `<div class="loading-spinner">Error: ${result.error}</div>`;
    }
  } catch (err) {
    console.error('Failed to load articles:', err);
    articlesGrid.innerHTML = '<div class="loading-spinner">Failed to connect to backend server. Make sure MySQL & Node app are running.</div>';
  }
}

// Render Articles Grid
function renderArticles(articles) {
  articleCountEl.textContent = articles.length;

  if (articles.length === 0) {
    articlesGrid.innerHTML = `
      <div class="loading-spinner">
        No articles found matching criteria. Click <strong>New Article</strong> to create one!
      </div>
    `;
    return;
  }

  articlesGrid.innerHTML = articles.map(art => {
    const tagsArray = art.tags ? art.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const formattedDate = new Date(art.published_at).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
    const avatarInitial = art.author_name ? art.author_name.charAt(0).toUpperCase() : 'U';

    return `
      <article class="article-card" data-id="${art.id}">
        <div>
          <div class="article-card-header">
            <div class="author-badge">
              <div class="author-avatar">${avatarInitial}</div>
              <span>${art.author_name || 'User #' + art.user_id}</span>
            </div>
            <span class="article-date">${formattedDate}</span>
          </div>

          <h3 class="article-title">${escapeHtml(art.title)}</h3>
          <p class="article-content">${escapeHtml(art.content)}</p>

          <div class="tags-list">
            ${tagsArray.map(t => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join('')}
          </div>
        </div>

        <div>
          <div class="article-card-footer">
            <div class="stats-group">
              <button class="stat-btn" onclick="toggleLike(${art.id})">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                <span id="like-count-${art.id}">${art.like_count || 0}</span> Likes
              </button>

              <button class="stat-btn" onclick="toggleCommentsSection(${art.id})">
                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                <span id="comment-count-${art.id}">${art.comment_count || 0}</span> Comments
              </button>
            </div>

            <div class="card-actions">
              <button class="icon-btn" onclick="editArticle(${art.id})" title="Edit Article">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="icon-btn delete" onclick="deleteArticle(${art.id})" title="Delete Article">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>

          <!-- Comments Drawer -->
          <div class="comments-section" id="comments-section-${art.id}">
            <div class="comments-list" id="comments-list-${art.id}">
              <span class="text-dim">Click comment button to view discussion.</span>
            </div>
            <div class="comment-input-box">
              <input type="text" id="comment-input-${art.id}" placeholder="Write a comment...">
              <button class="btn btn-primary" onclick="postComment(${art.id})">Post</button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// Filter Actions
function applyFilters() {
  const tag = filterTagInput.value.trim();
  const date = filterDateInput.value;
  loadArticles({ tag, date });
}

function resetFilters() {
  filterTagInput.value = '';
  filterDateInput.value = '';
  loadArticles();
}

// Modal Handlers
function openArticleModal(article = null) {
  document.getElementById('article-id').value = article ? article.id : '';
  document.getElementById('article-title').value = article ? article.title : '';
  document.getElementById('article-tags').value = article ? article.tags : '';
  document.getElementById('article-content').value = article ? article.content : '';
  document.getElementById('modal-title').textContent = article ? 'Edit Article' : 'Create New Article';
  articleModal.classList.add('active');
}

function closeArticleModal() {
  articleModal.classList.remove('active');
  articleForm.reset();
}

async function handleSaveArticle(e) {
  e.preventDefault();
  const id = document.getElementById('article-id').value;
  const title = document.getElementById('article-title').value.trim();
  const tags = document.getElementById('article-tags').value.trim();
  const content = document.getElementById('article-content').value.trim();

  const payload = { user_id: currentUserId, title, tags, content };
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/articles/${id}` : '/api/articles';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      closeArticleModal();
      loadArticles();
    } else {
      alert('Error: ' + result.error);
    }
  } catch (err) {
    console.error('Failed to save article:', err);
  }
}

async function editArticle(id) {
  const article = articlesData.find(a => a.id === id);
  if (article) {
    openArticleModal(article);
  }
}

async function deleteArticle(id) {
  if (!confirm('Are you sure you want to delete this article?')) return;
  try {
    const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      loadArticles();
    } else {
      alert('Failed to delete: ' + result.error);
    }
  } catch (err) {
    console.error('Failed to delete article:', err);
  }
}

// Comments & Likes API Actions
async function toggleCommentsSection(articleId) {
  const drawer = document.getElementById(`comments-section-${articleId}`);
  drawer.classList.toggle('open');
  if (drawer.classList.contains('open')) {
    loadComments(articleId);
  }
}

async function loadComments(articleId) {
  const listEl = document.getElementById(`comments-list-${articleId}`);
  try {
    const res = await fetch(`/api/comments/article/${articleId}`);
    const result = await res.json();
    if (result.success) {
      document.getElementById(`comment-count-${articleId}`).textContent = result.data.length;
      if (result.data.length === 0) {
        listEl.innerHTML = '<div style="color:#6b7280; font-size:0.8rem;">No comments yet. Be the first to comment!</div>';
      } else {
        listEl.innerHTML = result.data.map(c => `
          <div class="comment-item">
            <span class="comment-author">${escapeHtml(c.author_name)}:</span>
            <span>${escapeHtml(c.content)}</span>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error fetching comments:', err);
  }
}

async function postComment(articleId) {
  const inputEl = document.getElementById(`comment-input-${articleId}`);
  const content = inputEl.value.trim();
  if (!content) return;

  try {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ article_id: articleId, user_id: currentUserId, content })
    });
    const result = await res.json();
    if (result.success) {
      inputEl.value = '';
      loadComments(articleId);
    }
  } catch (err) {
    console.error('Error posting comment:', err);
  }
}

async function toggleLike(articleId) {
  try {
    const res = await fetch('/api/likes/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ article_id: articleId, user_id: currentUserId })
    });
    const result = await res.json();
    if (result.success) {
      // Refresh like count
      const likeRes = await fetch(`/api/likes/article/${articleId}`);
      const likeData = await likeRes.json();
      if (likeData.success) {
        document.getElementById(`like-count-${articleId}`).textContent = likeData.data.count;
      }
    }
  } catch (err) {
    console.error('Error toggling like:', err);
  }
}

async function handleCreateUser(e) {
  e.preventDefault();
  const username = document.getElementById('user-username').value.trim();
  const email = document.getElementById('user-email').value.trim();
  const password = document.getElementById('user-password').value;

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const result = await res.json();
    if (result.success) {
      userModal.classList.remove('active');
      userForm.reset();
      await loadUsers();
      currentUserSelect.value = result.id;
      currentUserId = result.id;
    } else {
      alert('Error creating user: ' + result.error);
    }
  } catch (err) {
    console.error('Failed to create user:', err);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}
