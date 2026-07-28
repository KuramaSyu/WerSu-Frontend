import React, { useEffect } from "react";
import { Box, Fade, Grow, Portal, alpha } from "@mui/material";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useSearchFilterStore } from "../../zustand/useSearchFilterStore";
import { M3 } from "../../statics";
import SearchOverlayHeader from "./header/SearchOverlayHeader";
import SearchOverlayToolbar from "./filter/SearchOverlayToolbar";
import SearchResultsList from "./results/SearchResultsList";
import {
  SearchResultsProvider,
  useSearchResults,
} from "./results/SearchResultsList.hook";

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
  const { isInitialLoading, isFetchingNextPage } = useSearchResults();

  // ESC closes the overlay and clears search state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        resetAll();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, resetAll]);

  return (
    <>
      <Fade in={open} timeout={theme.transitions.duration.complex} mountOnEnter>
        <Box
          onClick={onClose}
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: alpha(
              theme.blendAgainstContrast(
                theme.palette.background.default,
                0.5,
                undefined,
              ),
              0.8,
            ),
            zIndex: 900,
          }}
        />
      </Fade>

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
              zIndex: 1300,
              border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
              display: "flex",
              flexDirection: "column",
              gap: M3,
              p: M3,
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
  );
};

export const SearchResultsOverlay: React.FC<SearchResultsOverlayProps> = (
  props,
) => (
  <SearchResultsProvider>
    <SearchResultsOverlayInner {...props} />
  </SearchResultsProvider>
);

export default SearchResultsOverlay;
