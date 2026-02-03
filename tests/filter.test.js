import { describe, it, expect } from 'vitest';

// Test filter logic functions
describe('Filter Logic', () => {
  const posts = [
    { id: '1', title: 'Post 1', tags: [{ name: 'news' }, { name: 'tech' }] },
    { id: '2', title: 'Post 2', tags: [{ name: 'tutorial' }, { name: 'tech' }] },
    { id: '3', title: 'Post 3', tags: [{ name: 'news' }] },
    { id: '4', title: 'Post 4', tags: [] },
    { id: '5', title: 'Post 5', tags: [{ name: 'tech' }, { name: 'tutorial' }, { name: 'news' }] }
  ];

  // Simulate getFilteredPosts function
  function getFilteredPosts(filterTags, filterMode) {
    if (filterTags.length === 0) {
      return posts;
    }

    const filterTagNames = new Set(filterTags.map(t => t.name));

    return posts.filter(post => {
      const postTagNames = (post.tags || []).map(t => t.name);

      if (filterMode === 'AND') {
        return filterTags.every(ft => postTagNames.includes(ft.name));
      } else {
        return postTagNames.some(name => filterTagNames.has(name));
      }
    });
  }

  describe('OR mode (Any)', () => {
    it('returns all posts when no filter tags', () => {
      const result = getFilteredPosts([], 'OR');
      expect(result).toHaveLength(5);
    });

    it('returns posts with any of the selected tags', () => {
      const result = getFilteredPosts([{ name: 'news' }], 'OR');
      expect(result).toHaveLength(3);
      expect(result.map(p => p.id)).toEqual(['1', '3', '5']);
    });

    it('returns posts matching any of multiple tags', () => {
      const result = getFilteredPosts([{ name: 'news' }, { name: 'tutorial' }], 'OR');
      expect(result).toHaveLength(4);
      expect(result.map(p => p.id)).toEqual(['1', '2', '3', '5']);
    });

    it('returns empty when no posts match', () => {
      const result = getFilteredPosts([{ name: 'nonexistent' }], 'OR');
      expect(result).toHaveLength(0);
    });
  });

  describe('AND mode (All)', () => {
    it('returns all posts when no filter tags', () => {
      const result = getFilteredPosts([], 'AND');
      expect(result).toHaveLength(5);
    });

    it('returns posts with single tag', () => {
      const result = getFilteredPosts([{ name: 'tech' }], 'AND');
      expect(result).toHaveLength(3);
      expect(result.map(p => p.id)).toEqual(['1', '2', '5']);
    });

    it('returns only posts with ALL selected tags', () => {
      const result = getFilteredPosts([{ name: 'news' }, { name: 'tech' }], 'AND');
      expect(result).toHaveLength(2);
      expect(result.map(p => p.id)).toEqual(['1', '5']);
    });

    it('returns only post with all three tags', () => {
      const result = getFilteredPosts([{ name: 'news' }, { name: 'tech' }, { name: 'tutorial' }], 'AND');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('5');
    });

    it('returns empty when no posts have all tags', () => {
      const result = getFilteredPosts([{ name: 'news' }, { name: 'nonexistent' }], 'AND');
      expect(result).toHaveLength(0);
    });
  });

  describe('getCommonTags simulation', () => {
    function getCommonTags(selectedPostIds) {
      const selectedPostsList = posts.filter(p => selectedPostIds.includes(p.id));
      if (selectedPostsList.length === 0) return [];

      const firstPostTags = new Set((selectedPostsList[0].tags || []).map(t => t.name));

      for (let i = 1; i < selectedPostsList.length; i++) {
        const postTagNames = new Set((selectedPostsList[i].tags || []).map(t => t.name));
        for (const tagName of firstPostTags) {
          if (!postTagNames.has(tagName)) {
            firstPostTags.delete(tagName);
          }
        }
      }

      return Array.from(firstPostTags);
    }

    it('returns all tags for single post', () => {
      const result = getCommonTags(['1']);
      expect(result).toEqual(['news', 'tech']);
    });

    it('returns common tags between two posts', () => {
      const result = getCommonTags(['1', '2']);
      expect(result).toEqual(['tech']);
    });

    it('returns empty when posts have no common tags', () => {
      const result = getCommonTags(['2', '3']);
      expect(result).toEqual([]);
    });

    it('returns common tags for multiple posts', () => {
      const result = getCommonTags(['1', '5']);
      expect(result).toEqual(['news', 'tech']);
    });

    it('returns empty for post without tags', () => {
      const result = getCommonTags(['4']);
      expect(result).toEqual([]);
    });
  });
});
