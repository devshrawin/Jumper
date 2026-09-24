// Fuzzy matching for Jump. No dependencies.
// Each space-separated word in the query must match the title or the address.
// Exact substrings score highest, then letters in order ("gthb" -> "github").

(function (global) {
  const isBoundary = (text, i) => i === 0 || /[\s\-_/.:?#=&|,()[\]]/.test(text[i - 1]);

  function matchWord(word, text) {
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

  // Returns null when the item doesn't match, else { score, titleIdx, urlIdx }.
  function scoreItem(words, title, urlText) {
    let total = 0;
    const titleIdx = new Set();
    const urlIdx = new Set();
    for (const w of words) {
      const a = matchWord(w, title);
      const b = matchWord(w, urlText);
      if (!a && !b) return null;
      // Titles are what people remember, so they win ties.
      if (a && (!b || a.score + 10 >= b.score)) {
        total += a.score + 10;
        a.idx.forEach(i => titleIdx.add(i));
      } else {
        total += b.score;
        b.idx.forEach(i => urlIdx.add(i));
      }
    }
    return { score: total, titleIdx, urlIdx };
  }

  global.JumpFuzzy = { matchWord, scoreItem };
})(typeof window !== "undefined" ? window : globalThis);
