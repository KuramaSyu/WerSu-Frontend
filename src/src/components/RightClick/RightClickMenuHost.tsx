// The single mounted right-click surface.
//
// Subscribes to the store, resolves rows, renders the menu. Mounted
// once in App.tsx next to InfoDisplay.

import React, { useCallback, useEffect, useMemo } from "react";
import { useRightClickMenuStore } from "../../zustand/useRightClickMenuStore";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { resolveRightClickMenu } from "./resolveRightClickMenu";
import { rightClickMenuButtons } from "./rightClickMenuButtons";
import { RightClickMenu } from "./RightClickMenu";
import type { ResolvedMenuRow, RightClickHandler } from "./types";

export const RightClickMenuHost: React.FC = () => {
  const { isMobile } = useBreakpoint();
  const isOpen = useRightClickMenuStore((s) => s.isOpen);
  const request = useRightClickMenuStore((s) => s.request);
  const position = useRightClickMenuStore((s) => s.position);
  const disabledButtons = useRightClickMenuStore((s) => s.disabledButtons);
  const closeMenu = useRightClickMenuStore((s) => s.closeMenu);

  // Global fallback: right-clicking anywhere that a surface did not
  // already handle opens the base copy/paste menu. Text fields keep
  // their native menu (spellcheck, paste).
  useEffect(() => {
    if (isMobile) return;
    const onDocumentContextMenu = (event: MouseEvent) => {
      // Wired surfaces stop propagation, so reaching here means no
      // surface handled it. Text fields keep the native menu.
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          "input, textarea, select, [contenteditable]:not([contenteditable='false']), .MuiModal-root",
        )
      ) {
        return;
      }
      // Replaces any open menu, so right-clicking elsewhere moves it.
      event.preventDefault();
      useRightClickMenuStore.getState().openMenu({
        position: { x: event.clientX, y: event.clientY },
        buttons: ["copy", "paste"],
      });
    };
    document.addEventListener("contextmenu", onDocumentContextMenu);
    return () =>
      document.removeEventListener("contextmenu", onDocumentContextMenu);
  }, [isMobile]);

  // A context-menu position is a point, not an element, so use MUI's
  // anchorPosition reference. MUI still flips it away from viewport
  // edges for us.
  const anchorPosition = useMemo(
    () => ({ top: position.y, left: position.x }),
    [position],
  );

  const rows = useMemo(
    () =>
      request
        ? resolveRightClickMenu(request, rightClickMenuButtons, disabledButtons)
        : [],
    [request, disabledButtons],
  );

  // Same precedence the resolver used, so an enabled row always has a callable.
  const getHandler = useCallback(
    (row: ResolvedMenuRow): RightClickHandler | undefined => {
      if (row.kind === "custom") return undefined;
      return (
        request?.overrides?.[row.buttonId]?.handler ??
        rightClickMenuButtons[row.buttonId]?.handler
      );
    },
    [request],
  );

  const handleRun = useCallback(
    (handler: RightClickHandler) => {
      closeMenu();
      handler(request?.targetId);
    },
    [closeMenu, request],
  );

  // Decision 5: no context menu on touch devices, long-press already selects.
  if (isMobile || !isOpen || !request) return null;

  return (
    <RightClickMenu
      anchorPosition={anchorPosition}
      rows={rows}
      getHandler={getHandler}
      onRun={handleRun}
      onClose={closeMenu}
    />
  );
};

export default RightClickMenuHost;
