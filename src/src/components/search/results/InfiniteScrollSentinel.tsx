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

  useEffect(() => {
    const node = ref.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;

    // walk up to the nearest scrollable ancestor (the immediate parent isn't)
    let scrollRoot: Element | null = node.parentElement;
    while (scrollRoot && getComputedStyle(scrollRoot).overflowY !== "auto") {
      scrollRoot = scrollRoot.parentElement;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // disconnect immediately so repeated intersection frames don't refire
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          onLoadMore();
        }
      },
      { root: scrollRoot, rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  if (!hasNextPage && !isFetchingNextPage) return null;
  return (
    <Box ref={ref} sx={{ display: "flex", justifyContent: "center", py: M3 }} />
  );
};

export default InfiniteScrollSentinel;
