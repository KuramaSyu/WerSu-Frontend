/**
 * Lower-case, strip diacritics, collapse non-alphanumerics into
 * single hyphens, trim leading/trailing hyphens. Falls back to
 * `"section"` for the empty result so consumers always get a
 * non-empty id (e.g. a heading whose text is only punctuation).
 */
export function slugify(text: string): string {
  const stripped = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return stripped.length > 0 ? stripped : "section";
}

/**
 * Append `-2`, `-3`, ... to duplicate-text inputs so every entry
 * gets a unique slug. First occurrence of each base wins.
 */
export function uniqueSlugify(inputs: string[]): string[] {
  const seen = new Map<string, number>();
  return inputs.map((input) => {
    const base = slugify(input);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  });
}
