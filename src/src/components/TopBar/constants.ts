/**
 * Constants shared across the TopBar sub-components. Kept in one
 * file so future tweaks (e.g. a per-density "compact" mode) only
 * need to land here.
 */

/**
 * Maximum length of the visible message in a collapsed notification
 * row. Long messages get crumbled to this cap so the
 * `AccordionSummary` height stays bounded regardless of the worst
 * payload the app emits.
 *
 * 140 fits roughly two lines of `body2` on the wider 3/8-width
 * drawer — slightly tight on small screens but never overflows.
 */
export const NOTIFICATION_MESSAGE_CAP = 140;

/**
 * Maximum length of the visible description in the expanded body of
 * a notification row. Larger than the message cap because the
 * description renders with `pre-wrap` and we want at least a
 * paragraph of context when the user expands a row.
 */
export const NOTIFICATION_DESCRIPTION_CAP = 1500;

/**
 * Maximum height (in pixels) of the scrollable notification list
 * inside the user drawer. Sized so ~5 rows fit comfortably without
 * pushing the Logout button off-screen on a standard laptop.
 */
export const NOTIFICATIONS_PANEL_MAX_HEIGHT = 360;

/**
 * Width of the user drawer as a fraction of the viewport.
 *
 * Applied directly to the `SwipeableDrawer`'s `Paper` slot via
 * `slotProps.paper.sx` in `TopBar.tsx`, where MUI evaluates CSS
 * tokens at runtime — that's the only place the `"3/8"` literal
 * is valid (in CSS it would need to be `calc(3/8 * 100%)`, but
 * the MUI `sx` shorthand accepts the bare fraction).
 */
export const USER_DRAWER_WIDTH = "3/8";
