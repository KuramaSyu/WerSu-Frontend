/**
 * Generates a formatted note title string with the current date and time.
 *
 * @returns A string in the format "Note of {Weekday} {Month} {Day with ordinal} at {HH}:{MM}"
 * @example
 * // Returns something like: "Note of Mon January 1st at 14:30"
 * note_of_date_at_hour()
 */
export function note_of_date_at_hour(): string {
  var d = new Date();
  const day = d.getDate();
  const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const month = d.toLocaleString('en-US', { month: 'short' });
  const weekday = d.toLocaleString('en-US', { weekday: 'short' });
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `Note of ${weekday} ${ordinal(day)} ${month} at ${hours}:${minutes}`;
}
