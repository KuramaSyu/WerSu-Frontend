/**
 * makes labels distinct in case of duplicates.
 * first the bare label, then "label (firstId)",
 * then "label (firstId) (secondId)" when collisions remain.
 */
export const disambiguateLabels = <T>(
  items: readonly T[],
  getLabel: (item: T) => string,
  getFirstId: (item: T) => string,
  getSecondId?: (item: T) => string,
): Map<T, string> => {
  const labels = items.map((item) => getLabel(item));
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  // First pass: how often does each `label (firstId)` pair appear?
  const firstCounts = new Map<string, number>();
  items.forEach((item, index) => {
    const label = labels[index];
    if ((counts.get(label) ?? 0) <= 1) {
      return;
    }
    const key = `${label} (${getFirstId(item)})`;
    firstCounts.set(key, (firstCounts.get(key) ?? 0) + 1);
  });

  const out = new Map<T, string>();
  items.forEach((item, index) => {
    const label = labels[index];
    if ((counts.get(label) ?? 0) <= 1) {
      out.set(item, label);
      return;
    }
    const firstId = getFirstId(item);
    const firstVariant = `${label} (${firstId})`;
    if (!getSecondId || (firstCounts.get(firstVariant) ?? 0) <= 1) {
      out.set(item, firstVariant);
      return;
    }
    out.set(item, `${firstVariant} (${getSecondId(item)})`);
  });
  return out;
};
