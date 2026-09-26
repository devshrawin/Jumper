// Jump popup: lists open + recently closed tabs, filters as you type, switches on Enter.
const { scoreItem } = window.JumpFuzzy;

const $q = document.getElementById("q");
const $list = document.getElementById("list");
const $empty = document.getElementById("empty");
const $count = document.getElementById("count");

const MAX_ROWS = 60;
const isMac = navigator.userAgent.includes("Mac");
if (isMac) {
  document.getElementById("closeKey").textContent = "⌘⌫";
  document.getElementById("pinKey").textContent = "⌘⇧P";
  document.getElementById("muteKey").textContent = "⌘M";
  document.getElementById("copyKey").textContent = "⌘⇧U";
  document.getElementById("dupKey").textContent = "⌘⇧D";
}

let items = [];     // everything we could show
let view = [];      // what is shown right now, in order
let sel = 0;        // selected index in view

// ---------- loading ----------

function displayUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") {
      return (u.host + u.pathname + u.search).replace(/\/$/, "");
    }
  } catch (_) { /* fall through */ }
  return url.replace(/^[a-z-]+:\/\//i, "");
}

function faviconFor(pageUrl) {
  const u = new URL(chrome.runtime.getURL("/_favicon/"));
  u.searchParams.set("pageUrl", pageUrl);
  u.searchParams.set("size", "32");
  return u.toString();
}

const PAGE_TEXT_CHARS = 20000;
const PAGE_TEXT_TIMEOUT_MS = 4000;

// Best-effort: restricted pages (chrome://, the Web Store, PDFs the viewer
// blocks, etc.) throw here. That's fine, they just search title/url only.
// A hung tab can't stall the batch either — it just times out to "".
async function pageTextFor(tabId, url) {
  if (!/^https?:\/\//i.test(url || "")) return "";
  const timeout = new Promise(res => setTimeout(() => res(""), PAGE_TEXT_TIMEOUT_MS));
  const exec = chrome.scripting
    .executeScript({
      target: { tabId },
      func: (max) => (document.body ? document.body.innerText : "").slice(0, max),
      args: [PAGE_TEXT_CHARS]
    })
    .then(([{ result }]) => result || "")
    .catch(() => "");
  return Promise.race([exec, timeout]);
}

// Tabs we've already scanned this popup session, so retyping a query never
// re-injects into the same tab twice. Cleared each time the popup opens.
const pageTextLoaded = new Set();

// Only scans page bodies once there's an actual query to look for — never on
// popup open, and never for a tab you haven't searched against.
function scanPageBodies(query) {
  if (!query) return;
  for (const it of items) {
    if (it.kind !== "open" || pageTextLoaded.has(it.id)) continue;
    pageTextLoaded.add(it.id);
    pageTextFor(it.id, it.url).then(text => {
      it.pageText = text;
      // Ignore results for a query the user has since changed or cleared.
      if ($q.value.trim().toLowerCase() === query.toLowerCase()) render();
    });
  }
}

const HISTORY_WINDOW_MS = 30 * 24 * 3600 * 1000;

async function loadPinned() {
  const { pinned } = await chrome.storage.local.get("pinned");
  return new Set(pinned || []);
}

async function savePinned() {
  await chrome.storage.local.set({ pinned: [...pinnedUrls] });
}

let pinnedUrls = new Set();

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

// Recomputes how many other open tabs share each open tab's URL, so the
// "Duplicate" tag and Ctrl+Shift+D stay accurate after tabs close.
function refreshDupCounts() {
  const counts = new Map();
  for (const it of items) if (it.kind === "open") counts.set(it.url, (counts.get(it.url) || 0) + 1);
  for (const it of items) if (it.kind === "open") it.dupCount = (counts.get(it.url) || 1) - 1;
}

async function load() {
  const [tabs, closed, [current], pinned, historyRaw] = await Promise.all([
    chrome.tabs.query({}),
    chrome.sessions.getRecentlyClosed({ maxResults: 25 }),
    chrome.tabs.query({ active: true, currentWindow: true }),
    loadPinned(),
    chrome.history.search({ text: "", maxResults: 200, startTime: Date.now() - HISTORY_WINDOW_MS })
  ]);
  pinnedUrls = pinned;

  // Number windows in the order Chrome reports them, so tags read "Window 2".
  const windowNo = new Map();
  tabs.forEach(t => { if (!windowNo.has(t.windowId)) windowNo.set(t.windowId, windowNo.size + 1); });
  const multiWindow = windowNo.size > 1;

  // Tab group titles/colors, so a grouped tab's tag reads "Reading list"
  // instead of just its window number.
  const groupIds = [...new Set(tabs.map(t => t.groupId).filter(id => id !== undefined && id !== -1))];
  const groupInfo = new Map();
  await Promise.all(groupIds.map(async id => {
    try { groupInfo.set(id, await chrome.tabGroups.get(id)); } catch (_) { /* group gone */ }
  }));

  const open = tabs
    .filter(t => !current || t.id !== current.id)
    .map(t => {
      const group = groupInfo.get(t.groupId);
      return {
        kind: "open",
        id: t.id,
        windowId: t.windowId,
        title: t.title || displayUrl(t.url || ""),
        url: t.url || "",
        urlText: displayUrl(t.url || ""),
        recency: t.lastAccessed || 0,
        tag: group ? (group.title || `${capitalize(group.color)} group`) : (multiWindow ? `Window ${windowNo.get(t.windowId)}` : ""),
        pinned: pinnedUrls.has(t.url),
        muted: !!(t.mutedInfo && t.mutedInfo.muted)
      };
    })
    .sort((a, b) => (b.pinned - a.pinned) || (b.recency - a.recency));

  const openUrls = new Set(tabs.map(t => t.url));
  const recent = closed
    .filter(s => s.tab && s.tab.url && !s.tab.url.startsWith("chrome://newtab") && !openUrls.has(s.tab.url))
    .map(s => ({
      kind: "closed",
      sessionId: s.tab.sessionId,
      title: s.tab.title || displayUrl(s.tab.url),
      url: s.tab.url,
      urlText: displayUrl(s.tab.url),
      recency: (s.lastModified || 0) * 1000,
      tag: "Closed"
    }));

  const closedUrls = new Set(recent.map(r => r.url));
  const history = historyRaw
    .filter(h => h.url && !openUrls.has(h.url) && !closedUrls.has(h.url))
    .map(h => ({
      kind: "history",
      title: h.title || displayUrl(h.url),
      url: h.url,
      urlText: displayUrl(h.url),
      recency: h.lastVisitTime || 0,
      tag: "History"
    }));

  items = [...open, ...recent, ...history];
  refreshDupCounts();
}

// ---------- ranking ----------

function filter(query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) {
    // Most recently used first, so Enter on an empty box goes back to your previous tab.
    return items.map(it => ({ it, titleIdx: null, urlIdx: null }));
  }
  const scored = [];
  for (const it of items) {
    const m = scoreItem(words, it.title, it.urlText, it.pageText);
    if (!m) continue;
    const penalty = it.kind === "closed" ? 15 : it.kind === "history" ? 25 : 0;
    const bonus = it.pinned ? 500 : 0;
    scored.push({ it, score: m.score - penalty + bonus, titleIdx: m.titleIdx, urlIdx: m.urlIdx, pageHit: m.pageHit });
  }
  scored.sort((a, b) => b.score - a.score || b.it.recency - a.it.recency);
  return scored;
}

// ---------- rendering ----------

// Builds text with matched letters wrapped in <mark>. Uses text nodes only,
// so page titles can never inject HTML into the popup.
function highlighted(el, text, idx) {
  if (!idx || !idx.size) { el.textContent = text; return; }
  let run = "", inMark = false;
  const flush = () => {
    if (!run) return;
    if (inMark) { const m = document.createElement("mark"); m.textContent = run; el.appendChild(m); }
    else el.appendChild(document.createTextNode(run));
    run = "";
  };
  for (let i = 0; i < text.length; i++) {
    const hit = idx.has(i);
    if (hit !== inMark) { flush(); inMark = hit; }
    run += text[i];
  }
  flush();
}

function rowFor(entry, i) {
  const { it } = entry;
  const li = document.createElement("li");
  li.className = "row";
  li.id = "opt-" + i;
  li.setAttribute("role", "option");
  li.setAttribute("aria-selected", String(i === sel));

  const img = document.createElement("img");
  img.src = faviconFor(it.url);
  img.alt = "";

  const text = document.createElement("div");
  text.className = "text";
  const title = document.createElement("div");
  title.className = "title";
  highlighted(title, it.title, entry.titleIdx);
  if (it.pinned) {
    const star = document.createElement("span");
    star.className = "pin";
    star.textContent = "★ ";
    title.prepend(star);
  }
  const url = document.createElement("div");
  url.className = "url";
  highlighted(url, it.urlText, entry.urlIdx);
  text.append(title, url);

  li.append(img, text);
  const tags = [
    it.tag,
    it.dupCount ? `Duplicate ×${it.dupCount + 1}` : "",
    it.muted ? "Muted" : "",
    entry.pageHit ? "In page" : ""
  ].filter(Boolean);
  const tagText = tags.join(" · ");
  if (tagText) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = tagText;
    li.append(tag);
  }

  li.addEventListener("mousemove", () => { if (sel !== i) select(i); });
  li.addEventListener("click", () => activate(view[i]));
  return li;
}

function render() {
  const query = $q.value.trim();
  view = filter(query).slice(0, MAX_ROWS);
  sel = Math.min(sel, Math.max(view.length - 1, 0));

  $list.replaceChildren();
  const SECTION_LABEL = { closed: "Recently closed", history: "History" };
  let lastSection = null;
  view.forEach((entry, i) => {
    const kind = entry.it.kind;
    if (!query && kind !== "open" && kind !== lastSection) {
      const h = document.createElement("li");
      h.className = "section";
      h.setAttribute("role", "presentation");
      h.textContent = SECTION_LABEL[kind] || kind;
      $list.appendChild(h);
    }
    if (!query) lastSection = kind;
    $list.appendChild(rowFor(entry, i));
  });

  const openCount = items.filter(x => x.kind === "open").length + 1; // +1 for the current tab
  if (query) {
    const scanning = items.some(it => it.kind === "open" && !pageTextLoaded.has(it.id));
    $count.textContent = `${view.length} found${scanning ? " · scanning pages…" : ""}`;
    scanPageBodies(query);
  } else {
    $count.textContent = `${openCount} open`;
  }

  $empty.hidden = view.length > 0;
  if (!view.length) {
    $empty.textContent = query
      ? `No tabs match "${query}". Try fewer letters, part of the address, or wait a moment for page scanning to finish.`
      : "This is your only tab. Open a few more and Jump will list them here.";
  }
  syncSelection();
}

function syncSelection() {
  $list.querySelectorAll(".row").forEach(r => r.setAttribute("aria-selected", "false"));
  const row = document.getElementById("opt-" + sel);
  if (row) {
    row.setAttribute("aria-selected", "true");
    row.scrollIntoView({ block: "nearest" });
    $q.setAttribute("aria-activedescendant", row.id);
  } else {
    $q.removeAttribute("aria-activedescendant");
  }
}

function select(i) {
  if (!view.length) return;
  sel = (i + view.length) % view.length;
  syncSelection();
}

// ---------- actions ----------

async function activate(entry) {
  if (!entry) return;
  const { it } = entry;
  try {
    if (it.kind === "open") {
      await chrome.tabs.update(it.id, { active: true });
      await chrome.windows.update(it.windowId, { focused: true });
    } else if (it.kind === "closed") {
      await chrome.sessions.restore(it.sessionId);
    } else {
      await chrome.tabs.create({ url: it.url });
    }
  } finally {
    window.close();
  }
}

async function closeSelected() {
  const entry = view[sel];
  if (!entry || entry.it.kind !== "open") return;
  await chrome.tabs.remove(entry.it.id);
  items = items.filter(x => x !== entry.it);
  refreshDupCounts();
  render();
}

async function togglePin(entry) {
  if (!entry || entry.it.kind !== "open") return;
  const url = entry.it.url;
  if (pinnedUrls.has(url)) pinnedUrls.delete(url); else pinnedUrls.add(url);
  entry.it.pinned = pinnedUrls.has(url);
  await savePinned();
  // Re-sort the open section only, so a newly pinned tab jumps to the top now.
  const opens = items.filter(x => x.kind === "open").sort((a, b) => (b.pinned - a.pinned) || (b.recency - a.recency));
  const rest = items.filter(x => x.kind !== "open");
  items = [...opens, ...rest];
  render();
}

async function toggleMute(entry) {
  if (!entry || entry.it.kind !== "open") return;
  const next = !entry.it.muted;
  await chrome.tabs.update(entry.it.id, { muted: next });
  entry.it.muted = next;
  render();
}

async function copyUrl(entry) {
  if (!entry) return;
  try {
    await navigator.clipboard.writeText(entry.it.url);
    $count.textContent = "Copied URL";
  } catch (_) {
    $count.textContent = "Couldn't copy";
  }
  setTimeout(render, 900);
}

async function closeDuplicates(entry) {
  if (!entry || entry.it.kind !== "open" || !entry.it.dupCount) return;
  const url = entry.it.url;
  const dupes = items.filter(x => x.kind === "open" && x.url === url && x.id !== entry.it.id);
  await Promise.all(dupes.map(d => chrome.tabs.remove(d.id)));
  const removedIds = new Set(dupes.map(d => d.id));
  items = items.filter(x => !removedIds.has(x.id));
  refreshDupCounts();
  render();
}

// ---------- input ----------

$q.addEventListener("input", () => { sel = 0; render(); });

$q.addEventListener("keydown", e => {
  const ctrl = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  const entry = view[sel];
  if (e.key === "ArrowDown" || (ctrl && !e.shiftKey && key === "n")) { e.preventDefault(); select(sel + 1); }
  else if (e.key === "ArrowUp" || (ctrl && !e.shiftKey && key === "p")) { e.preventDefault(); select(sel - 1); }
  else if (e.key === "Enter") { e.preventDefault(); activate(entry); }
  else if ((ctrl && e.key === "Delete") || (e.metaKey && e.key === "Backspace")) { e.preventDefault(); closeSelected(); }
  else if (ctrl && e.shiftKey && key === "p") { e.preventDefault(); togglePin(entry); }
  else if (ctrl && !e.shiftKey && key === "m") { e.preventDefault(); toggleMute(entry); }
  else if (ctrl && e.shiftKey && key === "u") { e.preventDefault(); copyUrl(entry); }
  else if (ctrl && e.shiftKey && key === "d") { e.preventDefault(); closeDuplicates(entry); }
});

load().then(render).catch(err => {
  $empty.hidden = false;
  $empty.textContent = "Jump couldn't read your tabs: " + err.message;
});
$q.focus();
