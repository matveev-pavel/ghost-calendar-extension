# Ghost Calendar

Chrome extension for viewing scheduled Ghost blog posts in a convenient calendar or list format.

## Features

- **Two display modes** — list grouped by date or monthly calendar view
- **Quick editor access** — click on a post to open it in Ghost Admin
- **Side panel** — extension works in Chrome Side Panel without interfering with your workflow
- **Auto-refresh** — posts are loaded fresh when you open the panel
- **Tooltips** — hover over a calendar day to see the list of posts with publication times

## Installation

### From source (developer mode)

1. Download or clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked**
5. Select the `ghost-calendar-extension` folder

## Setup

1. Right-click the extension icon → **Options**
2. Enter your **Blog URL** (e.g., `https://blog.example.com`)
3. Enter your **Admin API Key**:
   - Open Ghost Admin → Settings → Integrations
   - Create a new integration or use an existing one
   - Copy the **Admin API Key** (format: `id:secret`)
4. Click **Test** to verify the connection
5. Click **Save**

## Usage

- Click the extension icon to open the side panel
- Switch between list and calendar modes using the buttons in the header
- Click on a post to open it in the Ghost editor

## Project Structure

```
ghost-calendar-extension/
├── manifest.json          # Extension manifest (v3)
├── background.js          # Service Worker
├── lib/
│   └── api.js             # Ghost Admin API module
├── sidepanel/
│   ├── sidepanel.html     # Main interface
│   ├── sidepanel.js       # Panel logic
│   └── sidepanel.css      # Styles
├── options/
│   ├── options.html       # Settings page
│   └── options.js         # Settings logic
└── icons/                 # Extension icons
```

## Requirements

- Google Chrome 114+ (Side Panel API support)
- Ghost 5.x with Admin API enabled

## Privacy

- API key is stored locally in `chrome.storage.sync`
- No data is sent to third parties
- See [PRIVACY.md](PRIVACY.md) for details

## License

MIT
