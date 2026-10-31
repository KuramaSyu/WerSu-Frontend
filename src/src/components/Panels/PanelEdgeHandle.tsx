import type { CSSProperties } from "react";
import { IconButton, Tooltip, useTheme } from "@mui/material";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

export interface PanelEdgeHandleProps {
  /** Which edge of the panel the handle sits on. */
  side: "left" | "right";
  /** Whether the panel is currently open. */
  open: boolean;
  /** Toggle handler. */
  onClick: () => void;
  /** Tooltip while the panel is open (the action collapses it). */
  collapseTitle: string;
  /** Tooltip while the panel is closed (the action expands it). */
  expandTitle: string;
  /**
   * Centre the handle on the viewport (`50vh`, minus the top bar)
   * instead of on its `position: relative` ancestor. Only safe when
   * that ancestor spans the full rail (e.g. the left rail); handles
   * mounted inside a single section must keep centring locally.
   */
  centerInViewport?: boolean;
}

// Tabler icons are flex items, so inside the narrow handle button they
// would be squeezed down to the button width. Absolutely positioning
// them keeps the chevron at its full size regardless of the pill size.
const iconOverlayStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  flexShrink: 0,
  pointerEvents: "none",
};

/**
 * Small collapse / expand handle that sits on a side-panel border.
 *
 * Positioned absolutely, so the caller only has to provide a
 * `position: relative` ancestor sitting on the desired border. The
 * chevron points towards where the panel will go: a handle on the
 * left panel's right border points left to collapse, while a handle
 * on the right panel's left border points right to collapse.
 */
export const PanelEdgeHandle: React.FC<PanelEdgeHandleProps> = ({
  side,
  open,
  onClick,
  collapseTitle,
  expandTitle,
  centerInViewport = false,
}) => {
  const theme = useTheme();

  const collapseIcon =
    side === "left" ? (
      <IconChevronLeft size={16} style={iconOverlayStyle} />
    ) : (
      <IconChevronRight size={16} style={iconOverlayStyle} />
    );
  const expandIcon =
    side === "left" ? (
      <IconChevronRight size={16} style={iconOverlayStyle} />
    ) : (
      <IconChevronLeft size={16} style={iconOverlayStyle} />
    );

  return (
    <Tooltip
      title={open ? collapseTitle : expandTitle}
      placement={side === "left" ? "right" : "left"}
    >
      <IconButton
        onClick={onClick}
        size="small"
        aria-label={open ? collapseTitle : expandTitle}
        sx={{
          position: "absolute",
          // When requested, centre on the viewport rather than the
          // panel's own box. The panel sits below the top bar, so `50%`
          // would land half a top-bar below the visual middle;
          // `--panel-top-offset` (set by the AppShell grid) compensates
          // for that push-down. Handles rendered inside a single section
          // keep the local `50%` centring.
          top: centerInViewport
            ? "calc(50vh - var(--panel-top-offset, 0px))"
            : "50%",
          ...(side === "left"
            ? { right: 0, transform: "translate(50%, -50%)" }
            : { left: 0, transform: "translate(-50%, -50%)" }),
          zIndex: 3,
          width: "1rem",
          height: "3.25rem",
          minWidth: 0,
          p: 0,
          borderRadius: "0.5rem",
          color: theme.palette.text.secondary,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: theme.shadows[1],
          transition: theme.transitions.create(["background-color", "color"]),
          "&:hover": {
            color: theme.palette.text.primary,
            backgroundColor: theme.palette.action.hover,
          },
        }}
      >
        {open ? collapseIcon : expandIcon}
      </IconButton>
    </Tooltip>
  );
};
