// Date helpers shared by the Hide submenu and its custom-date dialog.

const DAY_MS = 86_400_000;

/** ISO `YYYY-MM-DD` for a date offset from now. */
export function isoDateAfterDays(days: number): string {
  const date = new Date(Date.now() + days * DAY_MS);
  return date.toISOString().slice(0, 10);
}

/** Parse a date input as the end of that local day. */
export function endOfLocalDay(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return undefined;
  }
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    23,
    59,
    59,
    999,
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
}