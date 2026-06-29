import React, { useEffect, useRef, useState } from "react";
import { Box, Slide, SwipeableDrawer } from "@mui/material";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useLayout } from "../../LayoutProvider";
import { TopBarAppBar } from "./TopBarAppBar";
import { UserPanel } from "./UserPanel";
import { USER_DRAWER_WIDTH } from "./constants";

export interface TopBarProps {
  scrollContainer?: HTMLElement | null;
}

/**
 * The application top bar. Owns:
 *
 *   - scroll-driven show / hide (`useLayout().showTopBar`)
 *   - open / close state for the right-side user drawer
 *   - the `Slide` wrapping the `AppBar` and the `SwipeableDrawer`
 *     that hosts the `UserPanel`
 *
 * All presentational concerns — typography, nav buttons, the
 * notification list itself — live in the `TopBar/TopBarAppBar.tsx`,
 * `TopBar/UserPanel.tsx`, and `TopBar/NotificationsPanel.tsx`
 * siblings. This file is intentionally boring: it wires state
 * between the layout provider and the visual components.
 */
const TopBar: React.FC<TopBarProps> = ({ scrollContainer }) => {
  const { showTopBar: showBar, setShowTopBar: setShowBar } = useLayout();
  const { theme } = useThemeStore();
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const lastYRef = useRef(0);

  /**
   * Watchdog: hide the bar on downward scroll, show it on upward
   * scroll. Wrapped in `useEffect` rather than a top-level
   * listener so it's tied to the lifecycle of this component
   * instance (and the scroll target — `scrollContainer` for the
   * app shell, `window` if it's mounted standalone).
   */
  useEffect(() => {
    const TRIGGER_HIDE_DELTA = 4; // ignore tiny scrolls
    const target = scrollContainer ?? window;
    const getY = () =>
      scrollContainer ? scrollContainer.scrollTop : window.scrollY;
    lastYRef.current = getY();

    const onScroll = () => {
      const y = getY();
      const lastY = lastYRef.current;

      const delta = y - lastY;
      if (Math.abs(delta) < TRIGGER_HIDE_DELTA) {
        return;
      }

      if (delta > 0 && y > 24) {
        // Scrolling down → hide
        setShowBar(false);
      } else if (delta < 0) {
        // Scrolling up → show
        setShowBar(true);
      }

      lastYRef.current = y;
    };

    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [scrollContainer, setShowBar]);

  return (
    <>
      <Slide
        appear={false}
        direction="down"
        in={showBar}
        timeout={theme.transitions.duration.standard}
        easing={{
          enter: theme.transitions.easing.easeInOut,
          exit: theme.transitions.easing.easeInOut,
        }}
      >
        <Box>
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
        </Box>
      </Slide>
    </>
  );
};

export default TopBar;
