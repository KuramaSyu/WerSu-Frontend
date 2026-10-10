// noteStats
//
// Counters the metadata panel shows under "Content". Operates on the
// editor's flattened text (`state.doc.textContent`), which already
// separates block boundaries with `\n`.
//
// Definitions:
//   - words: contiguous non-whitespace runs
//   - letters: Unicode letters (`\p{L}`); digits and punctuation don't count
//   - rows: newline-separated lines that contain at least one
//     non-space character, so trailing blank lines don't bloat the count

const LETTER_RE = /\p{L}/gu;
const WORD_RE = /\S+/g;
const LINE_BREAK_RE = /\r?\n/;

export interface NoteStats {
  words: number;
  letters: number;
  rows: number;
}

/** Counts words, letters, and non-empty rows over `text`. */
export const computeStats = (text: string): NoteStats => {
  const letters = text.match(LETTER_RE)?.length ?? 0;
  const words = text.match(WORD_RE)?.length ?? 0;
  let rows = 0;
  for (const line of text.split(LINE_BREAK_RE)) {
    if (line.trim().length > 0) rows += 1;
  }
  return { words, letters, rows };
};
