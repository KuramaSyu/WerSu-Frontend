import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Box, Fade, Grow, Portal, SwipeableDrawer, alpha } from "@mui/material";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useSearchFilterStore } from "../../zustand/useSearchFilterStore";
import {
  M3,
  MODAL_BACKDROP_BLUR,
  MODAL_BACKDROP_COLOR,
} from "../../statics";
import SearchOverlayHeader from "./header/SearchOverlayHeader";
import SearchOverlayToolbar from "./filter/SearchOverlayToolbar";
import SearchResultsList from "./results/SearchResultsList";
import {
  SearchResultsProvider,
  useSearchResults,
} from "./results/SearchResultsList.hook";
import { useBreakpoint } from "../../hooks/useBreakpoint";

export interface SearchResultsOverlayProps {
  open: boolean;
  onClose: () => void;
}

// modal overlay shell: backdrop + portal + panel layout.
// renders header / toolbar / list as independent subtrees so keystrokes
// only re-render the header
const SearchResultsOverlayInner: React.FC<SearchResultsOverlayProps> = ({
  open,
  onClose,
}) => {
  const theme = useThemeStore((s) => s.theme);
  const resetAll = useSearchFilterStore((s) => s.resetAll);
  const applyAutoFilter = useSearchFilterStore((s) => s.applyAutoFilter);
  const location = useLocation();
  const { isInitialLoading, isFetchingNextPage } = useSearchResults();
  const { isMobile } = useBreakpoint();

  // When the overlay opens while viewing a directory (or one of its
  // sub-pages), prefill the filter to scope the search to that directory
  // and its descendants.
  useEffect(() => {
    if (!open) return;
    const match = /^\/d\/([^/]+)(?:\/|$)/.exec(location.pathname);
    const directoryId = match?.[1];
    if (!directoryId) return;
    applyAutoFilter({
      mode: "include",
      selectedDirs: [directoryId],
      scope: "subtree",
    });
  }, [open, location.pathname, applyAutoFilter]);

  // ESC closes the overlay and clears search state. Gated on `open`: the
  // mobile drawer stays mounted (hidden) after its first open, and an
  // ungated handler would close / wipe search state on every Escape the
  // user presses elsewhere in the app, including the note editor.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        resetAll();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, resetAll]);

  // Local open mirror so the swipe-down-to-close animation can
  // play before the parent flips `open` off and the drawer
  // unmounts. The `SwipeableDrawer` is uncontrolled while the
  // gesture is in progress; we sync the prop back via
  // `onOpen` / `onClose`.
  const [internalOpen, setInternalOpen] = useState(open);
  useEffect(() => {
    setInternalOpen(open);
  }, [open]);
  // Dismiss + clean: closing the overlay always wipes the query and
  // filters so reopening starts fresh. Used by the drawer gesture, the
  // drag handle and the desktop backdrop tap.
  const handleClose = () => {
    setInternalOpen(false);
    resetAll();
    onClose();
  };
  const handleOpen = () => {
    setInternalOpen(true);
  };

  return (
    <>
      {isMobile ? (
        // Mobile: bottom-anchored SwipeableDrawer with a
        // built-in backdrop. Swipe down (or tap the backdrop)
        // closes. The panel reserves
        // `MOBILE_BOTTOM_BAR_CLEARANCE` of bottom padding so the
        // last row of results stays above the mobile bottom bar.
        <SwipeableDrawer
          anchor="bottom"
          open={internalOpen}
          onOpen={handleOpen}
          onClose={handleClose}
          // Wide swipe area so the gesture is easy to discover.
          disableSwipeToOpen
          slotProps={{
            paper: {
              sx: {
                backgroundColor: theme.palette.background.default,
                borderTopLeftRadius: M3,
                borderTopRightRadius: M3,
                border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                // Reserve clearance for the bottom bar so the
                // last result row isn't hidden under it.
                // paddingBottom: MOBILE_BOTTOM_BAR_CLEARANCE,
                // Cap height so the drawer doesn't fill the
                // entire viewport -- the user should still see
                // some canvas behind it.
                height: "90%",
              },
            },
            backdrop: {
              sx: {
                backgroundColor: MODAL_BACKDROP_COLOR,
                backdropFilter: MODAL_BACKDROP_BLUR,
              },
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
              p: 1.5,
              // Touch-action "pan-y" lets the inner list scroll
              // vertically while the drawer's own swipe-down
              // gesture still works.
              touchAction: "pan-y",
            }}
          >
            {/* Drag handle: a small pill centred at the top of
                the drawer so the user has a visible affordance
                to grab. The drawer's `swipeAreaWidth={56}`
                already captures swipes anywhere in the top 56px
                strip; this is just the visual cue. */}
            <Box
              aria-hidden
              sx={{
                alignSelf: "center",
                width: 100,
                height: 4,
                borderRadius: 9999,
                backgroundColor: alpha(theme.palette.text.primary, 0.4),
                "&:hover": {
                  backgroundColor: alpha(theme.palette.text.primary, 0.6),
                },
                transition: theme.transitions.create("background-color", {
                  duration: theme.transitions.duration.short,
                }),
              }}
              onClick={() => handleClose()}
            />
            <SearchOverlayHeader onClose={onClose} />
            <SearchOverlayToolbar
              isInitialLoading={isInitialLoading}
              isFetchingNextPage={isFetchingNextPage}
            />
            <SearchResultsList />
          </Box>
        </SwipeableDrawer>
      ) : (
        // Desktop: fade backdrop + portal / grow panel. The backdrop
        // is portaled to `body` on purpose: `SearchBar` renders inside
        // the top bar, whose `willChange: transform` makes it the
        // containing block for fixed descendants. In-tree the backdrop
        // would only cover the bar itself, so taps outside never hit
        // it. Portaling restores true viewport coverage, and the blur
        // (shared with `Modal`) makes it read as a real modal
        // backdrop. `zIndex.modal - 1` keeps it above the app chrome
        // (top bar / rails) but below the panel.
        <>
          <Portal>
            <Fade
              in={open}
              timeout={theme.transitions.duration.complex}
              mountOnEnter
              unmountOnExit
            >
              <Box
                onClick={handleClose}
                aria-hidden
                sx={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: MODAL_BACKDROP_COLOR,
                  backdropFilter: MODAL_BACKDROP_BLUR,
                  zIndex: (t) => t.zIndex.modal - 1,
                }}
              />
            </Fade>
          </Portal>

          <Portal>
            <Grow
              in={open}
              timeout={theme.transitions.duration.short}
              mountOnEnter
              unmountOnExit
            >
              <Box
                sx={{
                  position: "fixed",
                  top: "100px",
                  left: "15%",
                  right: "15%",
                  maxHeight: "85%",
                  backgroundColor: theme.palette.background.default,
                  borderRadius: M3,
                  boxShadow: theme.shadows[8],
                  zIndex: (t) => t.zIndex.modal,
                  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                  p: 2,
                }}
              >
                <SearchOverlayHeader onClose={onClose} />
                <SearchOverlayToolbar
                  isInitialLoading={isInitialLoading}
                  isFetchingNextPage={isFetchingNextPage}
                />
                <SearchResultsList />
              </Box>
            </Grow>
          </Portal>
        </>
      )}
    </>
  );
};

export const SearchResultsOverlay: React.FC<SearchResultsOverlayProps> = (
  props,
) => (
  <SearchResultsProvider enabled={props.open}>
    <SearchResultsOverlayInner {...props} />
  </SearchResultsProvider>
);

export default SearchResultsOverlay;
