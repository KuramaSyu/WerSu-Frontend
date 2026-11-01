import React, { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { M3 } from "../../../statics";

interface Props {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

// fires `onLoadMore` once when the sentinel scrolls into view
export const InfiniteScrollSentinel: React.FC<Props> = ({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(isFetchingNextPage);
  isFetchingRef.current = isFetchingNextPage;

  useEffect(() => {
    const node = ref.current;
    if (!node || !hasNextPage) return;

    // walk up to the nearest scrollable ancestor (the immediate parent isn't)
    let scrollRoot: Element | null = node.parentElement;
    while (scrollRoot && getComputedStyle(scrollRoot).overflowY !== "auto") {
      scrollRoot = scrollRoot.parentElement;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Keep the observer alive so later scrolls can load more. Guard
        // with a ref instead of re-creating the observer when a fetch
        // finishes -- recreating it while the sentinel is still in view
        // caused an immediate fetchNextPage loop (offset 0, 30, 60...).
        if (
          entries.some((e) => e.isIntersecting) &&
          !isFetchingRef.current
        ) {
          onLoadMore();
        }
      },
      { root: scrollRoot, rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, onLoadMore]);

  if (!hasNextPage && !isFetchingNextPage) return null;
  return (
    <Box ref={ref} sx={{ display: "flex", justifyContent: "center", py: M3 }} />
  );
};

export default InfiniteScrollSentinel;
