import React, { Children, memo } from "react";
import { Box, Fade, Stack, Typography } from "@mui/material";
import { animated, useTrail } from "@react-spring/web";
import { LogoSvgComponent } from "../../../pages/LoadingPage/Main";
import { useThemeStore } from "../../../zustand/useThemeStore";
import { M3, M4 } from "../../../statics";

// staggered entrance for the empty-state text lines
export const TextTrail = ({ children }: { children: React.ReactNode }) => {
  const items = Children.toArray(children);
  const trail = useTrail(items.length, {
    from: { opacity: 0, transform: "translate3d(0,16px,0)" },
    to: { opacity: 1, transform: "translate3d(0,0px,0)" },
  });
  return (
    <>
      {trail.map((style, index) => (
        <animated.div key={index} style={style}>
          {items[index]}
        </animated.div>
      ))}
    </>
  );
};

interface Props {
  isInitialLoading: boolean;
  hasResults: boolean;
  searchQuery: string;
}

// shown while a fresh query has no hits and isn't loading. memoised so
// page-arrival re-renders in the list don't redraw the SVG / text.
const SearchResultsEmptyStateInner: React.FC<Props> = ({
  isInitialLoading,
  hasResults,
  searchQuery,
}) => {
  const theme = useThemeStore((s) => s.theme);
  const visible = !isInitialLoading && !hasResults;

  return (
    <Fade
      in={visible}
      timeout={{ enter: theme.transitions.duration.short, exit: 0 }}
      unmountOnExit
    >
      <Stack direction="row" sx={{ alignItems: "center" }}>
        <Stack
          direction="column"
          sx={{
            width: 3 / 8,
            px: M4,
            gap: M3,
            justifyItems: "center",
            alignItems: "center",
          }}
        >
          {/* re-key on the empty/non-empty boundary so useTrail re-fires
              only when we first cross into "no results" */}
          <TextTrail key={searchQuery ? "search" : "no-search"}>
            <Typography variant="h4" color="textPrimary">
              I took a deep dive,
            </Typography>
            <Typography variant="h5" color="textSecondary">
              but hell, there is no
            </Typography>
            <Typography
              color="primary"
              variant={searchQuery ? "h3" : "h6"}
              sx={{ py: M3 }}
            >
              {searchQuery || "Oh, you haven't even searched yet - nvm"}
            </Typography>
            {searchQuery && (
              <Typography variant="h5" color="textSecondary">
                in the abyss of your notes.
              </Typography>
            )}
          </TextTrail>
        </Stack>
        <Box sx={{ display: "flex", width: 5 / 8, justifyContent: "center" }}>
          <Box sx={{ display: "flex", width: 5 / 8, justifyContent: "center" }}>
            <LogoSvgComponent />
          </Box>
        </Box>
      </Stack>
    </Fade>
  );
};

export const SearchResultsEmptyState = memo(SearchResultsEmptyStateInner);

export default SearchResultsEmptyState;
