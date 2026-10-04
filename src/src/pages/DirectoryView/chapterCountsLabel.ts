/**
 * Builds the secondary-line label for a chapter row.
 * Only the non-zero half is shown so the badge stays compact.
 */
export function chapterCountsLabel(
  pages: number,
  subdirectories: number,
): string {
  if (pages === 0 && subdirectories === 0) {
    return "Empty";
  }
  const parts: string[] = [];
  if (pages > 0) {
    parts.push(`${pages} ${pages === 1 ? "page" : "pages"}`);
  }
  if (subdirectories > 0) {
    const subdirWord = subdirectories === 1 ? "subdirectory" : "subdirectories";
    parts.push(`${subdirectories} ${subdirWord}`);
  }
  return parts.join(" \u00B7 ");
}
