import type { SxProps, Theme } from "@mui/material/styles";

/**
 * Shared `IconButton` style for the side-rail chrome (collapse
 * toggle, search shortcut, notifications bell, avatar button). Bumps
 * the default MUI hit area + padding up so the rail icons feel as
 * chunky as the rest of the new layout, while still fitting inside
 * the open rail and the `COLLAPSED_PANEL_SIZE` gutter.
 */
export const panelIconButtonSx: SxProps<Theme> = {
  padding: "0.5rem",
};

/**
 * Shared SVG-icon style for the MUI icon set
 * (`SearchIcon`, `InboxIcon`, ...) used inside the rail's `IconButton`s.
 * Pairs with `panelIconButtonSx`: the button is 40px and the icon is
 * 24px so they line up cleanly. Tabler icons size themselves via
 * their own `size` prop, so this only applies to MUI icons.
 */
export const panelIconSvgSx: SxProps<Theme> = {
  fontSize: "1.5rem",
};
