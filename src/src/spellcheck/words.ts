// Turns plain text into the word ranges a spell checker should look at.
//
// The editor may contain URLs, identifiers and acronyms; flagging
// those would bury the real typos in noise.

export interface WordRange {
  /** The word as written. */
  word: string;
  /** Offset of the first character inside the scanned text. */
  from: number;
  /** Offset just past the last character inside the scanned text. */
  to: number;
}

// Unicode letters plus the apostrophe and hyphen that show up inside
// words ("doesn't", "E-Mail", "zurück"). Digits split words on
// purpose: "IPv6" or "h1" are not worth checking.
const WORD_PATTERN = /[\p{L}][\p{L}'’-]*/gu;

// Whitespace-delimited tokens we never spell check. Kept loose so a
// URL that happens to sit next to punctuation is still skipped.
const NON_WORD_TOKEN = /^(?:[a-z][a-z0-9+.-]*:\/\/|www\.)|@/iu;

function nonWordSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  for (const match of text.matchAll(/\S+/gu)) {
    if (!NON_WORD_TOKEN.test(match[0])) continue;
    const start = match.index ?? 0;
    spans.push([start, start + match[0].length]);
  }
  return spans;
}

function insideSpan(spans: Array<[number, number]>, from: number): boolean {
  return spans.some(([start, end]) => from >= start && from < end);
}

/** All-uppercase tokens are almost always acronyms or emphasis. */
function isAcronym(word: string): boolean {
  return word.length > 1 && word === word.toLocaleUpperCase();
}

/** Word ranges in `text`, with surrounding punctuation trimmed off. */
export function extractWordRanges(text: string): WordRange[] {
  if (!text) return [];
  const spans = nonWordSpans(text);
  const ranges: WordRange[] = [];

  for (const match of text.matchAll(WORD_PATTERN)) {
    let word = match[0];
    let from = match.index ?? 0;
    let to = from + match[0].length;

    while (word.length > 0 && /^['’-]/.test(word)) {
      word = word.slice(1);
      from += 1;
    }
    while (word.length > 0 && /['’-]$/.test(word)) {
      word = word.slice(0, -1);
      to -= 1;
    }

    // Single letters and acronyms are not typos.
    if (word.length < 2 || isAcronym(word)) continue;
    if (insideSpan(spans, from)) continue;

    ranges.push({ word, from, to });
  }

  return ranges;
}