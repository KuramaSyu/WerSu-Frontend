import { useLocation } from "react-router-dom";

/**
 * Route paths surfaced as buttons in the top bar. Kept in one place
 * so the `containedIfSelected` helper can stay type-safe without
 * duplicating string literals all over the component.
 */
export const Pages = {
  HOME: "/",
  FRIENDS: "/friends",
  SETTINGS: "/settings",
  HISTORY: "/history",
  SETTINGSV2: "/settings-v2",
  GRAPH: "/graph",
} as const;

export type Page = (typeof Pages)[keyof typeof Pages];

/**
 * Pick a `Button` `variant` based on whether `page` is the active
 * route. Lives next to `Pages` because the two pieces of logic are
 * tightly coupled. Named with the `use` prefix so the React Hooks
 * linter recognises it as a hook (it calls `useLocation`).
 */
export function useContainedIfSelected(page: Page): "contained" | "outlined" {
  const location = useLocation();
  return location.pathname === page ? "contained" : "outlined";
}
