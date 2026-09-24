// Fuzzy matching for Jump. No dependencies.
// Each space-separated word in the query must match the title or the address.
// Exact substrings score highest, then letters in order ("gthb" -> "github").

(function (global) {
  const isBoundary = (text, i) => i === 0 || /[\s\-_/.:?#=&|,()[\]]/.test(text[i - 1]);

  function matchWord(word, text, opts) {
    const fuzzy = !opts || opts.fuzzy !== false;
    const t = text.toLowerCase();

    // 1. Whole word appears as-is.
    const at = t.indexOf(word);
    if (at !== -1) {
      let score = 100 + word.length * 3 - Math.min(at, 40) * 0.5;
      if (isBoundary(t, at)) score += 30;
      const idx = [];
      for (let i = 0; i < word.length; i++) idx.push(at + i);
      return { score, idx };
    }

    // Page body text: substring only. Letter-scatter over a full page is noise, not a match.
    if (!fuzzy) return null;

    // 2. Letters appear in order, possibly with gaps.
    const idx = [];
    let from = 0, prev = -2, score = 0;
    for (const ch of word) {
      const f = t.indexOf(ch, from);
      if (f === -1) return null;
      score += f === prev + 1 ? 8 : 1;
      if (isBoundary(t, f)) score += 6;
      idx.push(f);
      prev = f;
      from = f + 1;
    }
    // Letters scattered across a long address are noise, not a match.
    const spread = idx[idx.length - 1] - idx[0] + 1;
    if (spread > word.length * 3 + 2) return null;
    score -= spread * 0.3;
    return { score, idx };
  }

  // Page body text only ever breaks ties in favor of title/url matches, never over them.
  const PAGE_TEXT_PENALTY = 20;

  // Returns null when the item doesn't match, else { score, titleIdx, urlIdx, pageHit }.
  function scoreItem(words, title, urlText, pageText) {
    let total = 0;
    const titleIdx = new Set();
    const urlIdx = new Set();
    let pageHit = false;
    for (const w of words) {
      const a = matchWord(w, title);
      const b = matchWord(w, urlText);
      const c = pageText ? matchWord(w, pageText, { fuzzy: false }) : null;
      if (!a && !b && !c) return null;
      // Titles are what people remember, so they win ties; url beats a page-text-only hit.
      if (a && (!b || a.score + 10 >= b.score) && (!c || a.score + 10 >= c.score - PAGE_TEXT_PENALTY)) {
        total += a.score + 10;
        a.idx.forEach(i => titleIdx.add(i));
      } else if (b && (!c || b.score >= c.score - PAGE_TEXT_PENALTY)) {
        total += b.score;
        b.idx.forEach(i => urlIdx.add(i));
      } else {
        total += c.score - PAGE_TEXT_PENALTY;
        pageHit = true;
      }
    }
    return { score: total, titleIdx, urlIdx, pageHit };
  }

  global.JumpFuzzy = { matchWord, scoreItem };
})(typeof window !== "undefined" ? window : globalThis);
