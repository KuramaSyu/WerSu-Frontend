import React, { useEffect, useRef, useState } from "react";
import { Box, Fade, LinearProgress } from "@mui/material";

const MIN_VISIBLE_MS = 500;

interface Props {
  isLoading: boolean;
  isFetchingNextPage: boolean;
}

// indeterminate progress bar; stays visible for at least MIN_VISIBLE_MS
// after the last active->idle transition so it doesn't flicker
export const SearchLoadingBar: React.FC<Props> = ({
  isLoading,
  isFetchingNextPage,
}) => {
  const [visible, setVisible] = useState(false);
  const wasActiveRef = useRef(false);
  const signalsRef = useRef({ isLoading, isFetchingNextPage });
  signalsRef.current = { isLoading, isFetchingNextPage };

  useEffect(() => {
    const isActive = isLoading || isFetchingNextPage;
    if (isActive && !wasActiveRef.current) setVisible(true);
    wasActiveRef.current = isActive;
  }, [isLoading, isFetchingNextPage]);

  useEffect(() => {
    if (!visible) return;
    const timeoutId = window.setTimeout(() => {
      const s = signalsRef.current;
      if (!s.isLoading && !s.isFetchingNextPage) setVisible(false);
    }, MIN_VISIBLE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [isLoading, isFetchingNextPage, visible]);

  return (
    <Box
      sx={{
        position: "relative",
        height: 2,
        mt: "-2px",
        mx: -1,
        pointerEvents: "none",
      }}
    >
      <Fade in={visible} timeout={{ enter: 500, exit: 500 }} unmountOnExit>
        <LinearProgress
          aria-label="Loading search results"
          sx={{ width: "100%", position: "absolute", top: 0, left: 0 }}
        />
      </Fade>
    </Box>
  );
};

export default SearchLoadingBar;
