# Jump — Fuzzy Tab Switcher

Too many tabs open? Hit a shortcut, type a few letters, land on the tab you want.

Jump is a Chrome extension (Manifest V3) that fuzzy-searches every open tab across every window, plus your recently closed tabs — by title or by URL. No exact spelling needed: `gthb` finds GitHub, `mdn grid` finds the MDN CSS grid page, `3000` finds your localhost dev server.

## Features

- **Search everything** — all open tabs, all windows, plus recently closed tabs, in one box
- **Fuzzy matching** — type partial/scrambled letters, still finds the right tab (`fuzzy.js`)
- **Reopen closed tabs** — same search box, same flow
- **Quick back** — press Enter on an empty search to jump to your previous tab
- **Close from the list** — `Ctrl+Delete` (`Cmd+Backspace` on Mac) closes the selected tab without switching to it
- **Keyboard-first** — default shortcut `Ctrl+Shift+Space` (`Cmd+Shift+Space` on Mac), remappable at `chrome://extensions/shortcuts`
- **Fully offline** — no accounts, no network requests, no analytics, no tracking. Nothing leaves your browser and nothing is stored to disk.

## How it works

| File | Role |
|---|---|
| `manifest.json` | MV3 config — permissions (`tabs`, `sessions`, `favicon`), popup wiring, keyboard shortcut |
| `popup.html` / `popup.css` | The search box UI shown when you trigger the shortcut |
| `popup.js` | Reads open/recently-closed tabs, wires up search input, handles switch/close/reopen actions |
| `fuzzy.js` | Fuzzy string-matching + ranking logic used to score tabs against your query |
| `icons/` | Toolbar + store icons (16/32/48/128px) |

Favicons are pulled from Chrome's own local favicon cache — never fetched from the live website.

## Install locally (unpacked, for testing/dev)

1. Open `chrome://extensions`
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked**
4. Select this folder (the one containing `manifest.json`)
5. Jump appears in your toolbar — press `Ctrl+Shift+Space` or click the icon to open it

Made a code change? Hit the reload icon (↻) on Jump's card in `chrome://extensions` — no re-zip needed while testing locally.

## Install from source (packaged .zip)

`jump-store-upload.zip` (if present) bundles just the runtime files — no docs, no promo assets — the same shape the Chrome Web Store expects. Unzip it anywhere and load that folder unpacked, same steps as above.

## Publishing to the Chrome Web Store

See [`STORE_LISTING.md`](STORE_LISTING.md) for the exact listing copy (description, permission justifications, category) and [`PRIVACY.md`](PRIVACY.md) / the hosted policy at [devshrawin.github.io/Jumper](https://devshrawin.github.io/Jumper/) for the required privacy policy URL.

## Privacy

Jump makes zero network requests and stores nothing on disk. Full policy: [`PRIVACY.md`](PRIVACY.md).

## License

Personal project — no license file yet. All rights reserved by default until one is added.
