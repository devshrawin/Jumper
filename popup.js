// Jump popup: lists open + recently closed tabs, filters as you type, switches on Enter.
const { scoreItem } = window.JumpFuzzy;

const $q = document.getElementById("q");
const $list = document.getElementById("list");
const $empty = document.getElementById("empty");
const $count = document.getElementById("count");

const MAX_ROWS = 60;
const isMac = navigator.userAgent.includes("Mac");
if (isMac) document.getElementById("closeKey").textContent = "⌘⌫";

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

async function load() {
  const [tabs, closed, [current]] = await Promise.all([
    chrome.tabs.query({}),
    chrome.sessions.getRecentlyClosed({ maxResults: 25 }),
    chrome.tabs.query({ active: true, currentWindow: true })
  ]);

  // Number windows in the order Chrome reports them, so tags read "Window 2".
  const windowNo = new Map();
  tabs.forEach(t => { if (!windowNo.has(t.windowId)) windowNo.set(t.windowId, windowNo.size + 1); });
  const multiWindow = windowNo.size > 1;

  const open = tabs
    .filter(t => !current || t.id !== current.id)
    .map(t => ({
      kind: "open",
      id: t.id,
      windowId: t.windowId,
      title: t.title || displayUrl(t.url || ""),
      url: t.url || "",
      urlText: displayUrl(t.url || ""),
      recency: t.lastAccessed || 0,
      tag: multiWindow ? `Window ${windowNo.get(t.windowId)}` : ""
    }))
    .sort((a, b) => b.recency - a.recency);

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

  items = [...open, ...recent];
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
    const m = scoreItem(words, it.title, it.urlText);
    if (!m) continue;
    const penalty = it.kind === "closed" ? 15 : 0;
    scored.push({ it, score: m.score - penalty, titleIdx: m.titleIdx, urlIdx: m.urlIdx });
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
  const url = document.createElement("div");
  url.className = "url";
  highlighted(url, it.urlText, entry.urlIdx);
  text.append(title, url);

  li.append(img, text);
  if (it.tag) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = it.tag;
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
  let closedHeaderShown = false;
  view.forEach((entry, i) => {
    if (!query && entry.it.kind === "closed" && !closedHeaderShown) {
      const h = document.createElement("li");
      h.className = "section";
      h.setAttribute("role", "presentation");
      h.textContent = "Recently closed";
      $list.appendChild(h);
      closedHeaderShown = true;
    }
    $list.appendChild(rowFor(entry, i));
  });

  const openCount = items.filter(x => x.kind === "open").length + 1; // +1 for the current tab
  $count.textContent = query ? `${view.length} found` : `${openCount} open`;

  $empty.hidden = view.length > 0;
  if (!view.length) {
    $empty.textContent = query
      ? `No tabs match "${query}". Try fewer letters, or part of the address.`
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
    } else {
      await chrome.sessions.restore(it.sessionId);
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
  render();
}

// ---------- input ----------

$q.addEventListener("input", () => { sel = 0; render(); });

$q.addEventListener("keydown", e => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) { e.preventDefault(); select(sel + 1); }
  else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) { e.preventDefault(); select(sel - 1); }
  else if (e.key === "Enter") { e.preventDefault(); activate(view[sel]); }
  else if ((ctrl && e.key === "Delete") || (e.metaKey && e.key === "Backspace")) { e.preventDefault(); closeSelected(); }
});

load().then(render).catch(err => {
  $empty.hidden = false;
  $empty.textContent = "Jump couldn't read your tabs: " + err.message;
});
$q.focus();
