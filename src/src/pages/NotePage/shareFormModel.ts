/**
 * Types, constants, and helpers for the share form.
 *
 * Kept separate from `ShareFormSection.tsx` so the React component file
 * only exports components — required by react-refresh / fast refresh.
 */

/**
 * Sentinel value used by the "Never expires" entry in `SCHEDULE_OPTIONS`.
 *
 * `null` is chosen over `Infinity` / a string sentinel so the value is
 * JSON-serializable, round-trips through React state predictably, and
 * stays obviously distinct from any real duration in seconds. The form
 * section, validator, and submit handler all special-case this value
 * (translating to/from the backend's "no `online_until`" semantics).
 */
export const NEVER_EXPIRES = null;

/**
 * One entry of the quick-pick schedule chips shown under the datetime
 * input. `value` is the duration in seconds for time-bounded options
 * and `NEVER_EXPIRES` for the "Never" chip.
 */
export interface ScheduleOption {
  children: string;
  value: number | typeof NEVER_EXPIRES;
  whenSelected: string;
}

/**
 * Quick-pick schedule presets shown as chips under the datetime input.
 *
 * Each finite entry carries the duration in seconds so the chip click
 * handler can resolve "now + seconds" into an absolute `onlineUntil`
 * datetime and write it back into the form. The "Never" entry uses
 * `NEVER_EXPIRES` as its sentinel — clicking it clears the expiry so
 * the share is submitted (and rendered) without an `online_until`.
 */
export const SCHEDULE_OPTIONS: readonly ScheduleOption[] = [
  { children: "1H", value: 60 * 60, whenSelected: "1 Hour" },
  { children: "1D", value: 60 * 60 * 24, whenSelected: "1 Day" },
  { children: "1W", value: 60 * 60 * 24 * 7, whenSelected: "1 Week" },
  { children: "1M", value: 60 * 60 * 24 * 30, whenSelected: "1 Month" },
  { children: "3M", value: 60 * 60 * 24 * 30 * 3, whenSelected: "3 Months" },
  { children: "1Y", value: 60 * 60 * 24 * 365, whenSelected: "1 Year" },
  { children: "Never", value: NEVER_EXPIRES, whenSelected: "Never" },
];

export type Visibility = "public" | "link" | "user";
export type Permission = "read" | "write";

/**
 * The form's *current* state — what the user has selected so far.
 *
 * `visibility` is currently only persisted client-side; the backend's
 * CreateShareBody doesn't yet expose it, but we keep it in the shape
 * so the UI is ready when it lands.
 *
 * `onlineUntil` is the absolute ISO timestamp at which the share
 * expires. It's stored as a string (not a Date) so the form stays
 * serializable and cheap to compare in the dirty check.
 */
export interface ShareFormValue {
  visibility: Visibility;
  permission: Permission;
  onlineUntil: string;
  description: string;
}

/**
 * Build a "blank" form value — used when entering create mode.
 *
 * Defaults match the original ShareDialog:
 *   - link-shared, read-only, expires in 1 month, no description.
 */
export const blankShareFormValue = (): ShareFormValue => {
  const oneMonthFromNow = new Date(
    Date.now() + 60 * 60 * 24 * 30 * 1000,
  ).toISOString();
  return {
    visibility: "link",
    permission: "read",
    onlineUntil: oneMonthFromNow,
    description: "",
  };
};
