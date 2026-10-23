// The single mounted right-click surface.
//
// Subscribes to the store, resolves rows, renders the menu. Mounted
// once in App.tsx next to InfoDisplay.

import React, { useCallback, useMemo } from "react";
import { useRightClickMenuStore } from "../../zustand/useRightClickMenuStore";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { resolveRightClickMenu } from "./resolveRightClickMenu";
import { rightClickMenuButtons } from "./rightClickMenuButtons";
import { RightClickMenu } from "./RightClickMenu";
import type { MenuPosition, ResolvedMenuRow, RightClickHandler } from "./types";

/**
 * A context-menu position is a point, not an element, so MUI gets a
 * virtual element whose rect is the requested coordinate. That keeps
 * viewport-edge flipping inside MUI rather than hand-rolled here.
 */
function virtualAnchor(position: MenuPosition): HTMLElement {
  return {
    getBoundingClientRect: () =>
      ({
        x: position.x,
        y: position.y,
        top: position.y,
        left: position.x,
        right: position.x,
        bottom: position.y,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  } as unknown as HTMLElement;
}

export const RightClickMenuHost: React.FC = () => {
  const { isMobile } = useBreakpoint();
  const isOpen = useRightClickMenuStore((s) => s.isOpen);
  const request = useRightClickMenuStore((s) => s.request);
  const position = useRightClickMenuStore((s) => s.position);
  const disabledButtons = useRightClickMenuStore((s) => s.disabledButtons);
  const closeMenu = useRightClickMenuStore((s) => s.closeMenu);

  const anchorEl = useMemo(() => virtualAnchor(position), [position]);

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
      anchorEl={anchorEl}
      rows={rows}
      getHandler={getHandler}
      onRun={handleRun}
      onClose={closeMenu}
    />
  );
};

export default RightClickMenuHost;
