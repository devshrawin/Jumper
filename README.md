# 🚀 Jump — Fuzzy Tab Switcher

Stop tab-hunting. Hit a shortcut, type a few letters, land exactly where you meant to go — across every open tab, every window, your closed tabs, your browsing history, and now even the *text on the page itself*.

```
Ctrl+Shift+Space  →  type "gthb"  →  you're on GitHub
```

No exact spelling. No clicking through 40 tabs. No accounts, no cloud, no tracking — everything runs locally in the popup.

## ✨ Features

### Search
- **Everything, one box** — open tabs (all windows), recently closed tabs, browser history (last 30 days), and now full page content
- **Fuzzy matching** — `mdn grid` finds the MDN CSS grid page, `3000` finds your localhost dev server, scrambled letters still hit
- **Search inside pages** — once you start typing, Jump scans the visible text of your open tabs and surfaces matches tagged **"In page"**, even when the word isn't in the title or URL
- **Live progress** — while page scanning is still catching up, the result count shows "scanning pages…" so you're never left wondering

### Organize
- **Pin tabs** — `Ctrl+Shift+P` stars a tab so it always sorts to the top, synced via `chrome.storage` so pins survive a browser restart
- **Tab groups, respected** — a tab inside a Chrome tab group shows its group's name (or color) as a tag instead of just a window number
- **Duplicate detector** — tabs sharing a URL get tagged `Duplicate ×2`; `Ctrl+Shift+D` closes every duplicate of the selected tab in one shot, keeping the one you're on
- **Multi-window aware** — tabs tagged `Window 2`, `Window 3`, etc. when you've got more than one window open

### Control
- **Mute toggle** — `Ctrl+M` silences (or unsilences) the tab blasting audio, without switching to it
- **Copy URL** — `Ctrl+Shift+U` grabs the selected tab's real URL to your clipboard, no navigation needed
- **Close without switching** — `Ctrl+Delete` closes the selected tab and stays right where you are
- **Reopen anything** — recently closed tabs and history results reopen with one `Enter`, same as any live tab
- **Quick back** — `Enter` on an empty search box jumps straight to your previous tab

### Keyboard reference

| Key | Action |
|---|---|
| `↑` `↓` (or `Ctrl+P`/`Ctrl+N`) | Move selection |
| `Enter` | Switch / reopen selected |
| `Ctrl+Delete` (`Cmd+Backspace`) | Close selected tab |
| `Ctrl+Shift+P` (`Cmd+Shift+P`) | Pin / unpin selected tab |
| `Ctrl+M` (`Cmd+M`) | Mute / unmute selected tab |
| `Ctrl+Shift+U` (`Cmd+Shift+U`) | Copy selected tab's URL |
| `Ctrl+Shift+D` (`Cmd+Shift+D`) | Close all duplicates of selected tab |
| `Esc` | Dismiss |

All remappable at `chrome://extensions/shortcuts` (the popup shortcut, `Ctrl+Shift+Space`) — the rest live inside the popup itself.

## 🧠 How the ranking works

Every space-separated word in your query has to match *something* — title, URL, or (once scanned) page body — or the tab doesn't show up at all. Matches are scored and ranked:

1. **Exact substring** scores highest, extra bonus if it starts on a word boundary (`/`, `-`, `.`, space, etc.)
2. **Scattered letters** (`gthb` → `g-i-t-h-u-b`) score lower, and get penalized if the letters are spread too thin across a long string — kills noise matches
3. **Page-body matches** are substring-only (no letter-scatter — too noisy over a full page) and always rank *below* a title/URL match on the same word
4. **Pinned tabs** get a flat scoring boost so they surface above equivalent unpinned matches
5. Ties break by most-recently-used

## 🏗️ Architecture

| File | Role |
|---|---|
| `manifest.json` | MV3 config — permissions, popup wiring, keyboard shortcut |
| `popup.html` / `popup.css` | The search UI |
| `popup.js` | Loads tabs/history/groups/pins, wires search input, handles every action |
| `fuzzy.js` | Pure scoring logic — no dependencies, fully unit-testable in isolation |
| `icons/` | Toolbar + store icons |

### Permissions, and why each exists

| Permission | Used for |
|---|---|
| `tabs` | Read open tab titles/URLs, switch/close/mute tabs |
| `sessions` | List and restore recently closed tabs |
| `favicon` | Show each tab's icon from Chrome's local favicon cache (never fetched from the live site) |
| `scripting` + `host_permissions: <all_urls>` | Read a tab's visible body text, only once you actually search |
| `storage` | Persist your pinned tabs across restarts |
| `history` | Fold in browsing history so you can jump back to a page you closed weeks ago |
| `tabGroups` | Read a tab group's name/color for its tag |

Page-content scanning is genuinely on-demand: it never runs when you open the popup, only starts the first time you type a query, and never re-scans a tab twice in the same popup session.

## 💻 Install locally (unpacked)

1. Open `chrome://extensions`
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked**
4. Select this folder (the one with `manifest.json`)
5. Jump appears in your toolbar — `Ctrl+Shift+Space` to open it

Changed the code? Hit the reload icon (↻) on Jump's card in `chrome://extensions`. New permissions (like when this feature set was added) trigger a one-time re-approval prompt.

## 📦 Install from source (packaged .zip)

`jump-store-upload.zip`, if present, bundles just the runtime files — no docs, no promo assets, the shape the Chrome Web Store expects. Unzip anywhere, load unpacked the same way.

## 🛍️ Publishing to the Chrome Web Store

See [`STORE_LISTING.md`](STORE_LISTING.md) for listing copy, category, and permission justifications, and [`PRIVACY.md`](PRIVACY.md) (hosted live at [devshrawin.github.io/Jumper](https://devshrawin.github.io/Jumper/)) for the required privacy policy URL.

**Note:** those two docs currently describe the pre-page-scanning, pre-history version of Jump — they need an update before store submission to reflect the `scripting`, `history`, `storage`, and `tabGroups` permissions this version adds.

## 🔒 Privacy

Nothing leaves your browser. No analytics, no ads, no third-party code, no network requests. Page-content scanning, history search, and pin storage all run and stay entirely local. Full policy: [`PRIVACY.md`](PRIVACY.md).

## License

Personal project — no license file yet. All rights reserved by default until one is added.
