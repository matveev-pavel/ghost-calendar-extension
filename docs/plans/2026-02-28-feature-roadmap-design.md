# Ghost Calendar Extension — Feature Roadmap Design

## Overview

Feature roadmap for Ghost Calendar Chrome Extension, expanding it beyond post scheduling into a comprehensive Ghost CMS management tool with AI capabilities.

Target audience: all Ghost bloggers (not a single blog).

## Approach

Low-hanging fruit first: quick wins → AI expansion → complex features.

---

## v2.1 — Quick Wins

### U4: Dark Mode

CSS custom properties (`--bg`, `--text`, `--border`, etc.) in `:root` and `[data-theme="dark"]`. Detection via `prefers-color-scheme: dark` media query + manual toggle in options. Theme preference stored in `chrome.storage.local`. Affects sidepanel.css, tags.css, options.html styles.

### U6: Auto-refresh

`setInterval` in sidepanel.js refreshes data every 5 minutes (configurable). Timer resets on manual Retry. Footer indicator: "Last updated: 2 min ago". Only active when sidepanel is open (no background polling).

### U5: Keyboard Shortcuts

Minimal set:
- `L` / `C` — switch List/Calendar view
- `F` — toggle filter bar
- `S` — open settings
- `R` — refresh data
- `Up`/`Down` — navigate posts in list

Implementation: `document.addEventListener('keydown')` in sidepanel.js. Ignore when focus is in input/textarea.

### C1: Drafts in Calendar

New `api.getDraftPosts()` method — Ghost API filter `status:draft`. Drafts displayed with distinct style (gray, dashed border, "draft" status badge). Click opens Ghost Editor. Drafts without `published_at` shown in a separate "Unscheduled drafts" section at bottom of list view. Toggle "Show drafts" button in header.

---

## v2.2 — AI Expansion

### AI Panel for Posts (A1 + A2 + A5 combined)

Single sparkle button (✨) on post hover → opens an AI panel with three actions:
- **Suggest Titles** (A5): generates 3-5 alternative titles. Click to apply via PUT `/posts/{id}/`.
- **Generate Excerpt** (A1): generates `custom_excerpt` (max 300 chars). Editable before saving.
- **Generate Meta** (A2): generates SEO-optimized `meta_description` (max 160 chars). Editable before saving.

Context for all: current title + excerpt + tags + meta_description. Reuses existing `OpenRouterAPI` class with streaming. Unified UI: tab-like selector in a popup/drawer.

AI panel only visible when OpenRouter API key is configured.

### U2: Export Schedule

"Export" button in sidepanel header. Format selector:
- **CSV**: date, time, title, status, tags
- **iCal (.ics)**: each post as calendar event, compatible with Google Calendar / Apple Calendar

Client-side generation via `URL.createObjectURL` + `<a download>`.

---

## v3.0 — Intelligence & Analytics

### Insights Screen (U1 + A4 combined)

New "Insights" view accessible from sidepanel header (graph icon). Two sections:

**Analytics (pure JS, no AI):**
- Posts per week/month count
- Distribution by day of week (histogram)
- Top 5 tags by post count
- Publication gaps (days without posts)

**AI Recommendations (OpenRouter call):**
- Pass statistics to AI, get text recommendations
- Examples: "Optimize by publishing on Tue/Thu", "Tag X has no posts for 3 weeks"
- Saves tokens by computing stats client-side, only sending summary to AI

Data source: existing loaded posts + additional API request for 3-month history.

### A3: AI Content Plan

"Suggest posts" button available in Calendar view on empty days or in header. User selects tag/topic → AI analyzes last 10-20 posts by tag (titles + excerpts) → suggests 5-10 new post ideas (title + brief description). One-click to save as Ghost draft. Uses streaming for real-time display.

### U3: Notifications

`chrome.alarms` API for background timers + `chrome.notifications` for alerts. Background.js checks scheduled posts every 30 minutes. Notifications at 1 hour and 15 minutes before publication. Settings in options: on/off, intervals.

### C3: Post Preview

Click on post (or hover + preview button) → inline card expansion with: excerpt, first paragraph (via `api.request('/posts/{id}/?formats=plaintext')`), feature image enlarged. Quick view without opening Ghost Admin.

---

## v3.1 — Advanced Features

### C2: Content Plan Slots

In Calendar view, create "empty slots" — placeholder cards with topic/tag on a specific date. Stored in `chrome.storage.local` (not Ghost API). Visually distinct (dashed border, "+" icon). Click → creates Ghost draft with pre-filled title and tags. Integration with A3: AI suggestions can be distributed across slots.

### U7: Batch Date Editing

In selection mode, add "Shift dates" action. Select multiple posts → specify +/- N days → all shift. Useful for rescheduling a series of posts. API calls execute sequentially (Ghost API has no batch endpoint).

---

## Release Summary

| Version | Features | Focus |
|---------|----------|-------|
| v2.1 | Dark mode, auto-refresh, shortcuts, drafts | Quick wins, UX polish |
| v2.2 | AI panel (titles/excerpt/meta), export | AI core, productivity |
| v3.0 | Insights (analytics + AI), content plan, notifications, preview | Intelligence |
| v3.1 | Content slots, batch dates | Advanced planning |
