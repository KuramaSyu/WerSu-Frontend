import type { Theme } from "@mui/material/styles";

/**
 * Text color that stays readable on the AppBar surface in either mode.
 *
 * In light mode the AppBar is `palette.primary.main`, so
 * `primary.contrastText` (white-ish on the colored bar) is the right
 * choice. In dark mode MUI applies a paper-toned overlay at elevation
 * > 0, so the effective surface is `palette.background.paper` and
 * `text.primary` is what reads against it.
 *
 * Use this for buttons/inputs that sit inside the topbar and don't
 * rely on `color="inherit"` (e.g. the outlined SearchBar button).
 *
 * Args:
 *     theme: the active MUI theme (only `palette.mode`,
 *         `palette.primary.contrastText`, `palette.text.primary` are
 *         read).
 *
 * Returns:
 *     A hex/rgb color string suitable for `color` / `border` props.
 */
export function topbarContrastText(theme: Theme): string {
  if (theme.palette.mode === "dark") {
    return theme.palette.text.primary;
  }
  return (
    theme.palette.primary.contrastText ??
    theme.palette.getContrastText(theme.palette.primary.main)
  );
}
