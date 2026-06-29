import React, { useState } from "react";
import { SwipeableDrawer } from "@mui/material";
import { useLayout } from "../../LayoutProvider";
import { TopBarAppBar } from "./TopBarAppBar";
import { UserPanel } from "./UserPanel";
import { USER_DRAWER_WIDTH } from "./constants";
import { useTopBarScrollVisibility } from "./useTopBarScrollVisibility";

export interface TopBarProps {
  scrollContainer?: HTMLElement | null;
}

/**
 * The application top bar. Owns:
 *
 *   - scroll-driven show / hide (`useLayout().showTopBar`); the
 *     actual `<Slide>` lives inside `TopBarAppBar` so it can wrap
 *     the `position: fixed` `AppBar` directly.
 *   - open / close state for the right-side user drawer
 *
 * All presentational concerns — typography, nav buttons, the
 * notification list itself, the slide animation — live in the
 * `TopBar/TopBarAppBar.tsx`, `TopBar/UserPanel.tsx`, and
 * `TopBar/NotificationsPanel.tsx` siblings. This file is
 * intentionally boring: it wires state between the layout
 * provider, the AppBar, and the SwipeableDrawer.
 */
const TopBar: React.FC<TopBarProps> = ({ scrollContainer }) => {
  const { setShowTopBar: setShowBar } = useLayout();
  // Note: `showTopBar` is consumed by `<TopBarAppBar>`'s `<Slide>`,
  // not here. The scroll watchdog flips it via `setShowBar`.
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);

  // Scroll-driven show/hide. The hook owns the listener lifecycle
  // and the last-Y ref; the rule itself is a pure helper in
  // `useTopBarScrollVisibility.ts` for unit testing.
  useTopBarScrollVisibility(scrollContainer, setShowBar);

  return (
    <>
      {/* `<Slide>` lives inside `TopBarAppBar` so it can wrap the
          `position: fixed` `AppBar` directly (the slide target needs
          to be `position: fixed` / `absolute` to animate). The
          `SwipeableDrawer` is a *sibling* of the slide target on
          purpose — the drawer's Modal is `position: fixed` and would
          otherwise slip out of the slide target's transform, leaving
          the user drawer visible at the wrong moment. */}
      <TopBarAppBar onOpenUserDrawer={() => setUserDrawerOpen(true)} />
      <SwipeableDrawer
        anchor="right"
        onOpen={() => setUserDrawerOpen(true)}
        open={userDrawerOpen}
        onClose={() => setUserDrawerOpen(false)}
        slotProps={{
          // Size the *root* slot, which under `variant="temporary"`
          // is MUI's `Modal` — the flex container that holds the
          // sliding `Paper`. The `Modal` defaults to `display:
          // flex; align-items: center`, so the Paper is centered
          // within whatever width we pin on the root. Without
          // `flexShrink: 0` the flex container would collapse the
          // child under its intrinsic size if any descendant
          // overflowed.
          root: {
            sx: {
              width: USER_DRAWER_WIDTH,
              maxWidth: USER_DRAWER_WIDTH,
              flexShrink: 0,
            },
          },
        }}
      >
        <UserPanel onRequestClose={() => setUserDrawerOpen(false)} />
      </SwipeableDrawer>
    </>
  );
};

export default TopBar;
