/**
 * TypeScript port of
 * https://github.com/KuramaSyu/inu/blob/main/inu/utils/string_crumbler.py
 *
 * The Python module exists because Discord / Telegram-style bots need
 * to split arbitrarily long user strings into "chunks" that fit under
 * a per-message length cap without breaking words mid-character. The
 * frontend uses the same idea for one slightly different reason: when
 * the user copies a long error description out of the notification
 * drawer and pastes it somewhere with a hard cap, we'd rather give
 * them a clean split than a truncated message — so this module is
 * shared by both the `Copy` button on the notification rows and any
 * future "share long text" affordance.
 *
 * Behaviour summary:
 *   - `crumble(text)`       — one string, may be split into multiple.
 *   - `crumble([s1, s2])`   — list in, list out; each input starts a
 *                             fresh group at the *next* cap boundary.
 *   - `separator`           — primary split mark. When omitted and the
 *                             input is plain prose, the module falls
 *                             back to a sentence-aware splitter so the
 *                             result reads naturally.
 *   - `cleanCode`           — if true, unbalanced ``` fences are
 *                             closed so downstream renderers that
 *                             process the output won't blow up.
 *
 * Edge cases:
 *   - A single "word" larger than `maxLength` throws `WordTooBig`.
 *     That mirrors the Python behaviour and is intentional — there's
 *     no way to split a 5KB URL into 2KB chunks without losing data.
 *
 * The exported function is intentionally pure and synchronous so it
 * can run inside a render without violating React's purity rules.
 */

/**
 * Raised when a single token exceeds the configured chunk size and
 * therefore cannot be split without losing data.
 */
export class WordTooBig extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WordTooBig";
  }
}

export interface CrumbleOptions {
  /** Maximum length of any returned chunk. Defaults to 2000. */
  maxLength?: number;
  /**
   * Primary separator to split on. When omitted (and the input is a
   * string), the module falls back to a sentence-aware splitter that
   * prefers paragraph breaks > newlines > punctuation > spaces.
   */
  separator?: string | null;
  /**
   * If true and a chunk ends with an unbalanced ``` fence, close the
   * fence so downstream renderers (e.g. markdown viewers) don't
   * consume everything that follows looking for a closer.
   * Defaults to `true`.
   */
  cleanCode?: boolean;
}

/**
 * Priority list of sentence-boundary symbols, ranked from "most
 * paragraph-y" to "least". Mirrors the Python `SentenceInterator`
 * priority list — we keep the order because consumers may rely on
 * "split at the paragraph break first".
 */
const SENTENCE_BREAKS = [
  "\n\n\n",
  "\n\n",
  "\n",
  "; ",
  ". ",
  "? ",
  "! ",
  ",",
  ") ",
  "} ",
  "] ",
  ": ",
  " ",
  "",
] as const;

/**
 * Greedy word-bag packer: walk the words left-to-right, start a new
 * chunk whenever adding the next word (plus its separator length)
 * would exceed `maxLength`. Returns the chunks with the separator
 * re-inserted between words. Empty words are preserved so the count
 * of `""` slots in the input matches the output slots.
 */
function packByLength(words: string[], maxLength: number, separator: string): string[] {
  const out: string[] = [];
  let bucket: string[] = [];
  let bucketLen = 0;

  const flush = () => {
    out.push(bucket.join(separator));
    bucket = [];
    bucketLen = 0;
  };

  for (const word of words) {
    if (word.length > maxLength) {
      // Defer: flush whatever we have, then surface the error after
      // the loop. Mirrors the Python behaviour of failing the whole
      // call rather than mid-stream.
      flush();
      throw new WordTooBig(
        `Word in iterable was bigger (${word.length}) than the max given string length (${maxLength})`,
      );
    }
    // +1 accounts for the separator re-insertion between words.
    const candidate = bucketLen === 0 ? word.length : bucketLen + separator.length + word.length;
    if (candidate > maxLength && bucket.length > 0) {
      flush();
    }
    bucket.push(word);
    bucketLen = candidate;
  }
  flush();
  return out;
}

/**
 * Split a single string with a real separator into chunks of at most
 * `maxLength` characters. Empty input produces an empty result so the
 * list-of-strings fast path stays uniform.
 */
function splitBySeparator(text: string, maxLength: number, separator: string): string[] {
  if (text.length === 0) return [];
  const tokens = text.split(separator);
  return packByLength(tokens, maxLength, separator);
}

/**
 * Sentence-aware splitter used when no explicit separator is given.
 *
 * Walks `text` in `maxLength`-wide windows, preferring to cut at the
 * highest-priority boundary that lands at >= 2/3 of the window (so we
 * never cut almost at the end of a paragraph just to take one extra
 * character).
 */
function splitBySentences(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const out: string[] = [];
  let pos = 0;
  while (pos + maxLength < text.length) {
    let splitAt = -1;
    let pickedSymbol = "";
    const window = text.slice(pos, pos + maxLength);

    for (const sym of SENTENCE_BREAKS) {
      const occurrence = window.lastIndexOf(sym);
      if (occurrence === -1) continue;
      // The Python version rejects cuts in the last third of the
      // window — keeps paragraphs from being chopped at the last
      // sentence.
      if (occurrence < (maxLength / 3) * 2) continue;
      splitAt = occurrence;
      pickedSymbol = sym;
      break;
    }

    if (splitAt === -1) {
      // No "nice" boundary found — fall back to a hard cut. Better
      // a mid-character split than an infinite loop.
      out.push(text.slice(pos, pos + maxLength));
      pos += maxLength;
      continue;
    }

    const chunk = text.slice(pos, pos + splitAt + pickedSymbol.length);
    out.push(chunk);
    pos += splitAt + pickedSymbol.length;
  }
  // `text.slice(pos)` is usually the remainder, which is non-empty
  // unless we landed exactly at EOF on the previous step.
  const tail = text.slice(pos);
  if (tail.length > 0) out.push(tail);
  return out;
}

/**
 * Close any unbalanced ` ``` ` fence inside `chunk`. Mirrors the
 * Python `clean_code=True` post-processing.
 */
function balanceCodeFences(chunk: string): string {
  const fenceCount = (chunk.match(/```/g) ?? []).length;
  if (fenceCount % 2 !== 0) {
    return chunk.endsWith("\n") ? `${chunk}\`\`\`` : `${chunk}\n\`\`\``;
  }
  return chunk;
}

/**
 * Crumble `text` into a list of strings of at most `maxLength`
 * characters each. See the file header for the full behavioural
 * contract.
 */
export function crumble(
  text: string | string[],
  maxLength = 2000,
  separator: string | null | undefined = undefined,
  options: { cleanCode?: boolean } = {},
): string[] {
  const { cleanCode = true } = options;
  const bareStrings = Array.isArray(text) ? text : [text];

  // Strip before splitting — Python does this and it mirrors the
  // "input is messy, output is clean" intent.
  const normalised = bareStrings.map((s) => s.trim());
  const effectiveMax = Math.max(1, maxLength);

  // Fast path: if everything already fits, filter out the empties
  // and return the survivors (still trimmed). Matches the Python
  // implementation's `any(...)` early return, but tightened to
  // never surface empty chunks — those were the original
  // "crumble('') returns ['']" footgun.
  const allFit = normalised.every((s) => s.length <= effectiveMax);
  if (allFit) {
    const nonEmpty = normalised.filter((s) => s.length > 0);
    return cleanCode ? nonEmpty.map(balanceCodeFences) : nonEmpty;
  }

  // When the user passed a separator that isn't actually present,
  // and the auto-switch is on, fall back to the newline. The Python
  // module does this to handle "notes that only have line breaks".
  let sep = separator ?? undefined;
  if (
    sep !== undefined &&
    typeof text === "string" &&
    !text.includes(sep)
  ) {
    sep = "\n";
  }

  const crumbled: string[] = [];

  if (sep !== undefined) {
    for (const t of normalised) {
      // Empty strings should not produce an empty chunk in the
      // middle of a list — they collapse to a 0-token split.
      if (t.length === 0) continue;
      crumbled.push(...splitBySeparator(t, effectiveMax, sep));
    }
  } else {
    for (const t of normalised) {
      if (t.length === 0) continue;
      crumbled.push(...splitBySentences(t, effectiveMax));
    }
  }

  if (!cleanCode) return crumbled;
  return crumbled.map(balanceCodeFences);
}
