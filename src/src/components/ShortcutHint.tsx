import React, { useCallback, useState } from "react";
import { Popover } from "@mui/material";
import { KeyboardShortcut } from "../utils/renderShortcut";
import { useShortcutModifierStore } from "../zustand/useShortcutModifierStore";

interface ShortcutHintProps {
  /**
   * Shortcut in `renderShortcut` notation, e.g. "ctrl+n". When
   * the user holds Ctrl/Cmd a popover anchored to the child
   * opens and shows the shortcut chip. Omit for elements that
   * have no shortcut, in which case the wrapper is a no-op.
   *
   * The popover renders exactly this chip (or the override in
   * `body`) -- never any descriptive text. The icon / button
   * label already names the action, so additional prose in the
   * popover would be noise.
   */
  shortcut?: string;
  /**
   * Override for the popover body. Use this when one popover
   * needs to surface multiple shortcuts (e.g. a toggle group
   * where the popover lists every available key side-by-side).
   * Bypasses the single-chip behaviour of `shortcut`.
   */
  body?: React.ReactNode;
  children: React.ReactElement;
  placement?: "top" | "bottom" | "left" | "right";
}

/**
 * Computes the Popover's `anchorOrigin` / `transformOrigin`
 * from a coarse `placement`.
 *
 * The MUI Popover picks from a 3x3 grid (`top` / `center` /
 * `bottom` x `left` / `center` / `right`). We translate the
 * four coarse values ourselves so call sites can think in
 * `top / bottom / left / right`:
 *
 *   - `placement=top`    -> popover sits ABOVE the anchor
 *   - `placement=bottom` -> popover sits BELOW the anchor
 *   - `placement=left`   -> popover sits to the LEFT of the anchor
 *   - `placement=right`  -> popover sits to the RIGHT of the anchor
 *
 * `center` is used for the perpendicular axis so the popover
 * is always centred on the anchor along that axis.
 */
function placementOrigins(placement: ShortcutHintProps["placement"]): {
  anchorOrigin: {
    vertical: "top" | "center" | "bottom";
    horizontal: "left" | "center" | "right";
  };
  transformOrigin: {
    vertical: "top" | "center" | "bottom";
    horizontal: "left" | "center" | "right";
  };
} {
  switch (placement) {
    case "bottom":
      return {
        anchorOrigin: { vertical: "top", horizontal: "center" },
        transformOrigin: { vertical: "bottom", horizontal: "center" },
      };
    case "left":
      return {
        anchorOrigin: { vertical: "center", horizontal: "right" },
        transformOrigin: { vertical: "center", horizontal: "left" },
      };
    case "right":
      return {
        anchorOrigin: { vertical: "center", horizontal: "left" },
        transformOrigin: { vertical: "center", horizontal: "right" },
      };
    case "top":
    default:
      return {
        anchorOrigin: { vertical: "bottom", horizontal: "center" },
        transformOrigin: { vertical: "top", horizontal: "center" },
      };
  }
}

/**
 * Popover that surfaces only the keyboard shortcut for an
 * element.
 *
 * Anchors to its child and opens whenever the global Ctrl/Cmd
 * modifier is held (driven by `useShortcutModifierStore`). The
 * popover stays open while the user holds the modifier, so the
 * shortcut labels for every registered action are visible at
 * once.
 *
 * `placement` controls where the popover sits relative to the
 * anchor:
 *
 *   - `top` (default) -> above the anchor
 *   - `bottom` -> below the anchor
 *   - `left` -> to the left of the anchor
 *   - `right` -> to the right of the anchor
 *
 * `anchorEl` lives in `useState`, not `useRef`. The Popover
 * reads `anchorEl` during render, which would trip the
 * `react-hooks/refs` lint rule if it came from a ref; capturing
 * it in a ref callback and storing the result in state keeps the
 * read rule-compliant.
 */
export const ShortcutHint: React.FC<ShortcutHintProps> = ({
  shortcut,
  body,
  children,
  placement = "top",
}) => {
  const isModifierPressed = useShortcutModifierStore(
    (s) => s.isModifierPressed,
  );

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const showPopover = (Boolean(shortcut) || Boolean(body)) && isModifierPressed;

  const setAnchor = useCallback((node: HTMLSpanElement | null) => {
    setAnchorEl(node);
  }, []);

  const origins = placementOrigins(placement);

  // `body` wins when passed (callers that want to render
  // multiple chips); otherwise render the single chip from
  // `shortcut`.
  const popoverBody =
    body !== undefined ? (
      body
    ) : shortcut ? (
      <KeyboardShortcut shortcut={shortcut} />
    ) : null;

  return (
    <span ref={setAnchor} style={{ display: "inline-flex" }}>
      {children}
      {showPopover && anchorEl && popoverBody ? (
        <Popover
          open
          anchorEl={anchorEl}
          anchorOrigin={origins.anchorOrigin}
          transformOrigin={origins.transformOrigin}
          disablePortal
          slotProps={{
            paper: {
              sx: {
                pointerEvents: "none",
                borderRadius: 1,
                px: 1,
                py: 0.25,
              },
            },
          }}
        >
          {popoverBody}
        </Popover>
      ) : null}
    </span>
  );
};
