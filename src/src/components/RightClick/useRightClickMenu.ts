// Ergonomic entry point for any surface that wants a right-click menu.
//
// The touch gate lives here so no call site has to repeat it.

import React, { useCallback, useMemo } from "react";
import { useRightClickMenuStore } from "../../zustand/useRightClickMenuStore";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import type { RightClickMenuRequest } from "./types";

/** Everything except the position, which the hook reads off the event. */
export type RightClickMenuSpec = Omit<RightClickMenuRequest, "position">;

export const useRightClickMenu = () => {
  const { isMobile } = useBreakpoint();
  const openMenu = useRightClickMenuStore((s) => s.openMenu);

  // Stable identity matters: surfaces spread this onto memoised children.
  const onContextMenu = useCallback(
    (event: React.MouseEvent, spec: RightClickMenuSpec) => {
      if (isMobile) return;
      event.preventDefault();
      event.stopPropagation();
      openMenu({ ...spec, position: { x: event.clientX, y: event.clientY } });
    },
    [isMobile, openMenu],
  );

  return useMemo(() => ({ onContextMenu }), [onContextMenu]);
};

export default useRightClickMenu;
