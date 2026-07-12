/**
 * Builds the secondary-line label for a chapter row.
 *
 * Always shows both counts separated by a middle dot so the badge stays
 * stable across renders (no layout shifts as counts change between zero
 * and non-zero).
 */
export function chapterCountsLabel(
  pages: number,
  subdirectories: number,
): string {
  const pageWord = pages === 1 ? "page" : "pages";
  const subdirWord = subdirectories === 1 ? "subdirectory" : "subdirectories";
  return `${pages} ${pageWord} \u00B7 ${subdirectories} ${subdirWord}`;
}
