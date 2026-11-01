// ---------------------------------------------------------------------------
// findReplace
// Pure, DOM-free search/replace primitives for the in-note find widget.
// The rich (ProseMirror) and source (textarea) surfaces share this
// module so both interpret match-case / whole-word / regex / preserve-
// case identically. No editor or React imports here on purpose: the
// functions are unit-testable in isolation.
// ---------------------------------------------------------------------------

/** Toggles that change how the query is matched. */
export interface FindReplaceOptions {
  /** When true, the search is case sensitive. */
  caseSensitive: boolean;
  /** When true, only whole words match (`\b`-delimited). */
  wholeWord: boolean;
  /** When true, the query is a regular expression. */
  regex: boolean;
}

/** A single hit inside a flat string. */
export interface TextMatch {
  /** Inclusive start offset. */
  from: number;
  /** Exclusive end offset. */
  to: number;
  /** Matched substring. */
  text: string;
  /** Regex capture groups (empty for literal searches). */
  groups: string[];
}

export const DEFAULT_FIND_REPLACE_OPTIONS: FindReplaceOptions = {
  caseSensitive: false,
  wholeWord: false,
  regex: false,
};

/** Escape a literal query so it can be embedded in a RegExp. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build the global RegExp for a query, or `null` when the query is
 * empty or (for regex mode) invalid. Callers treat `null` as "no
 * matches" rather than throwing so a half-typed regex never crashes
 * the editor.
 */
export function compileFindRegex(
  query: string,
  options: FindReplaceOptions,
): RegExp | null {
  if (!query) return null;
  const body = options.regex ? query : escapeRegex(query);
  const wrapped = options.wholeWord ? `\\b(?:${body})\\b` : body;
  try {
    return new RegExp(wrapped, options.caseSensitive ? "g" : "gi");
  } catch {
    return null;
  }
}

/** Whether the current query compiles. Empty queries are considered valid. */
export function isFindQueryValid(
  query: string,
  options: FindReplaceOptions,
): boolean {
  if (!query) return true;
  return compileFindRegex(query, options) !== null;
}

/** Find every match of `query` inside `text`. Zero-length hits are skipped. */
export function findTextMatches(
  text: string,
  query: string,
  options: FindReplaceOptions,
): TextMatch[] {
  const regex = compileFindRegex(query, options);
  if (!regex) return [];
  const matches: TextMatch[] = [];
  let result: RegExpExecArray | null;
  while ((result = regex.exec(text)) !== null) {
    const matched = result[0];
    if (matched.length === 0) {
      // Avoid an infinite loop on patterns like `a*` / `^`.
      regex.lastIndex += 1;
      if (regex.lastIndex > text.length) break;
      continue;
    }
    matches.push({
      from: result.index,
      to: result.index + matched.length,
      text: matched,
      groups: result.slice(1).map((group) => group ?? ""),
    });
  }
  return matches;
}

/**
 * Re-shape a replacement to follow the letter case of the matched text,
 * mirroring VS Code's "Preserve Case". Handles the common shapes:
 * `UPPER`, `lower` and `Capitalized`; mixed case is left untouched.
 */
export function preserveCase(source: string, replacement: string): string {
  if (!source || !replacement) return replacement;
  const letters = source.replace(/[^A-Za-z]/g, "");
  if (!letters) return replacement;
  if (letters === letters.toUpperCase()) {
    return replacement.toUpperCase();
  }
  if (letters === letters.toLowerCase()) {
    return replacement.toLowerCase();
  }
  // First letter upper, everything else lower -> capitalize the
  // replacement's first character only.
  if (/^[A-Z][a-z]*$/.test(letters)) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/** Expand `$&`, `$$` and `$1..$99` in a replacement using a match. */
export function expandReplacementToken(
  template: string,
  match: TextMatch,
  useRegex: boolean,
): string {
  if (!useRegex) return template;
  return template.replace(/\$(?:\$|&|\d{1,2})/g, (token) => {
    if (token === "$$") return "$";
    if (token === "$&") return match.text;
    const index = Number(token.slice(1));
    if (index === 0) return match.text;
    return match.groups[index - 1] ?? "";
  });
}

/** Build the literal text a single match should be replaced with. */
export function buildReplacementText(
  match: TextMatch,
  replacement: string,
  options: FindReplaceOptions & { preserveCase?: boolean },
): string {
  let value = expandReplacementToken(replacement, match, options.regex);
  if (options.preserveCase) {
    value = preserveCase(match.text, value);
  }
  return value;
}

/** Replace every match in a flat string. Returns the original when none. */
export function replaceAllInText(
  text: string,
  query: string,
  replacement: string,
  options: FindReplaceOptions & { preserveCase?: boolean },
): string {
  const matches = findTextMatches(text, query, options);
  if (matches.length === 0) return text;
  let output = "";
  let cursor = 0;
  for (const match of matches) {
    output += text.slice(cursor, match.from);
    output += buildReplacementText(match, replacement, options);
    cursor = match.to;
  }
  output += text.slice(cursor);
  return output;
}
