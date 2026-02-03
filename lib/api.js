/**
 * Ghost Admin API module
 * Provides JWT authorization and post data retrieval
 */

class GhostAPI {
  constructor(blogUrl, apiKey) {
    // HTTPS check to prevent MITM attacks
    const normalizedUrl = blogUrl.replace(/\/$/, '');
    try {
      const parsed = new URL(normalizedUrl);
      if (parsed.protocol !== 'https:') {
        throw new Error('Blog URL must use HTTPS for secure connection');
      }
    } catch (e) {
      if (e.message.includes('HTTPS')) {
        throw e;
      }
      throw new Error('Invalid blog URL format');
    }

    this.blogUrl = normalizedUrl;
    this.apiKey = apiKey;
    this.token = null;
    this.tokenExp = 0;
  }

  /**
   * Generate JWT token for Ghost Admin API
   */
  async generateToken() {
    const [id, secret] = this.apiKey.split(':');
    if (!id || !secret) {
      throw new Error('Invalid API key format. Expected format: id:secret');
    }

    // Validate hex format of secret
    if (!/^[a-f0-9]+$/i.test(secret)) {
      throw new Error('Invalid secret format in API key. Secret must be in hex format');
    }

    if (secret.length % 2 !== 0) {
      throw new Error('Invalid secret length in API key. Length must be even');
    }

    // Decode hex secret to bytes
    const keyBytes = new Uint8Array(
      secret.match(/.{2}/g).map(byte => parseInt(byte, 16))
    );

    // Import key for HMAC
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Create header and payload
    const header = { alg: 'HS256', typ: 'JWT', kid: id };
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 300; // 5 minutes
    const payload = { iat: now, exp, aud: '/admin/' };

    // Base64URL encode
    const base64UrlEncode = (obj) => {
      const str = JSON.stringify(obj);
      const base64 = btoa(str);
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };

    const headerB64 = base64UrlEncode(header);
    const payloadB64 = base64UrlEncode(payload);
    const message = `${headerB64}.${payloadB64}`;

    // Sign
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    this.token = `${message}.${signatureB64}`;
    this.tokenExp = exp;

    return this.token;
  }

  /**
   * Get current token (with automatic refresh)
   */
  async getToken() {
    const now = Math.floor(Date.now() / 1000);
    if (!this.token || now >= this.tokenExp - 30) {
      await this.generateToken();
    }
    return this.token;
  }

  /**
   * Execute request to Ghost Admin API
   */
  async request(endpoint, options = {}) {
    const token = await this.getToken();
    const url = `${this.blogUrl}/ghost/api/admin${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Ghost ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = error.errors?.[0]?.message || `HTTP ${response.status}`;
      throw new Error(message);
    }

    // Handle empty responses (e.g., DELETE returns 204 No Content)
    if (response.status === 204) {
      return null;
    }

    // Try to parse JSON, return null if empty
    const text = await response.text();
    if (!text) {
      return null;
    }

    return JSON.parse(text);
  }

  /**
   * Get scheduled posts
   */
  async getScheduledPosts() {
    const data = await this.request(
      '/posts/?filter=status:scheduled&order=published_at%20asc&fields=id,title,slug,status,published_at,feature_image,custom_excerpt,updated_at&include=tags&limit=all'
    );
    return data.posts || [];
  }

  /**
   * Get current updated_at of a post
   */
  async getPostUpdatedAt(postId) {
    const data = await this.request(`/posts/${postId}/?fields=id,updated_at`);
    return data.posts[0].updated_at;
  }

  /**
   * Update post publication date
   */
  async updatePostDate(postId, newDate) {
    const updatedAt = await this.getPostUpdatedAt(postId);
    const data = await this.request(`/posts/${postId}/`, {
      method: 'PUT',
      body: JSON.stringify({
        posts: [{
          published_at: newDate,
          updated_at: updatedAt
        }]
      })
    });
    return data.posts[0];
  }

  /**
   * Update post tags
   */
  async updatePostTags(postId, tags) {
    const updatedAt = await this.getPostUpdatedAt(postId);
    const data = await this.request(`/posts/${postId}/`, {
      method: 'PUT',
      body: JSON.stringify({
        posts: [{
          tags: tags.map(t => typeof t === 'string' ? { name: t } : t),
          updated_at: updatedAt
        }]
      })
    });
    return data.posts[0];
  }

  /**
   * Get all blog tags with pagination (Ghost API max 100 per request)
   */
  async getAllTags() {
    let allTags = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const data = await this.request(`/tags/?limit=100&page=${page}&fields=id,name,slug`);
      const tags = data.tags || [];
      allTags = allTags.concat(tags);

      // Check if there are more pages
      hasMore = data.meta?.pagination?.next !== null;
      page++;
    }

    return allTags;
  }

  /**
   * Get all tags with post count (paginated)
   */
  async getTagsWithCount() {
    let allTags = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const data = await this.request(`/tags/?limit=100&page=${page}&include=count.posts`);
      const tags = data.tags || [];
      allTags = allTags.concat(tags);

      hasMore = data.meta?.pagination?.next !== null;
      page++;
    }

    return allTags;
  }

  /**
   * Get posts by tag slug (for AI description generation)
   * @param {string} tagSlug - Tag slug (Ghost API filters by slug, not ID)
   * @param {Object} options - Options
   * @param {number} options.limit - Max posts to return (default 10)
   */
  async getPostsByTag(tagSlug, { limit = 10 } = {}) {
    const filter = `tag:${tagSlug}`;
    const data = await this.request(
      `/posts/?filter=${encodeURIComponent(filter)}&order=published_at%20desc&fields=id,title,meta_description,custom_excerpt&limit=${limit}`
    );
    return data.posts || [];
  }

  /**
   * Create a new tag
   */
  async createTag(tagData) {
    const data = await this.request('/tags/', {
      method: 'POST',
      body: JSON.stringify({ tags: [tagData] })
    });
    return data.tags[0];
  }

  /**
   * Update an existing tag
   */
  async updateTag(tagId, tagData) {
    const data = await this.request(`/tags/${tagId}/`, {
      method: 'PUT',
      body: JSON.stringify({
        tags: [tagData]
      })
    });
    return data.tags[0];
  }

  /**
   * Delete a tag
   */
  async deleteTag(tagId) {
    await this.request(`/tags/${tagId}/`, {
      method: 'DELETE'
    });
  }

  /**
   * Delete multiple tags
   * @param {string[]} tagIds - Array of tag IDs to delete
   * @returns {Promise<{deleted: string[], failed: Array<{id: string, error: string}>}>}
   */
  async deleteTags(tagIds) {
    const results = { deleted: [], failed: [] };

    for (const tagId of tagIds) {
      try {
        await this.deleteTag(tagId);
        results.deleted.push(tagId);
      } catch (error) {
        results.failed.push({ id: tagId, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get published posts starting from specified date
   */
  async getPublishedPosts(since) {
    const fromDate = since || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    fromDate.setHours(0, 0, 0, 0);
    const filter = `status:published+published_at:>='${fromDate.toISOString()}'`;
    const data = await this.request(
      `/posts/?filter=${encodeURIComponent(filter)}&order=published_at%20asc&fields=id,title,slug,status,published_at,feature_image,custom_excerpt,updated_at&include=tags&limit=all`
    );
    return data.posts || [];
  }

  /**
   * Get all posts (for debugging)
   */
  async getAllPosts(limit = 15) {
    const data = await this.request(
      `/posts/?order=published_at%20desc&fields=id,title,slug,status,published_at&limit=${limit}`
    );
    return data.posts || [];
  }

  /**
   * Get editor URL for a post
   */
  getEditorUrl(postId) {
    return `${this.blogUrl}/ghost/#/editor/post/${postId}`;
  }
}

// Helper function to create API from storage
async function createAPIFromStorage() {
  const { blogUrl, apiKey } = await chrome.storage.local.get(['blogUrl', 'apiKey']);

  if (!blogUrl || !apiKey) {
    throw new Error('Settings not configured. Please open extension settings.');
  }

  return new GhostAPI(blogUrl, apiKey);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GhostAPI, createAPIFromStorage };
}
