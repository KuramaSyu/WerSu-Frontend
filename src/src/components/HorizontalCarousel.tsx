import React, {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Box, IconButton, type SxProps, type Theme } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

export interface HorizontalCarouselProps {
  /** Items to render side-by-side in the row. */
  children: React.ReactNode;
  /** Pixel gap between items. Default 16. */
  gap?: number;
  /** Whether to render the left/right scroll arrows. Default true. */
  arrows?: boolean;
  /** sx applied to the outer (relative-positioned) wrapper. */
  sx?: SxProps<Theme>;
  /** sx applied to the horizontal scroll track. */
  trackSx?: SxProps<Theme>;
  /** sx applied to each arrow IconButton. */
  arrowSx?: SxProps<Theme>;
  /** className forwarded to the outer wrapper. */
  className?: string;
}

/**
 * Horizontal row of `children` with optional left/right scroll arrows.
 *
 * Each arrow click advances the scroll position by exactly one item
 * (Netflix-style). Arrows auto-hide when there is nothing to scroll
 * in their direction, or when every item fits without overflow.
 *
 * The track only captures the horizontal axis: the native scrollbar is
 * hidden and the arrows drive navigation. Vertical wheel/touch events
 * pass through to children, so cards with their own `overflow-y: auto`
 * still scroll normally.
 *
 * ```tsx
 * <HorizontalCarousel gap={12}>
 *   <Card />
 *   <Card />
 *   <Card />
 * </HorizontalCarousel>
 * ```
 */
export const HorizontalCarousel: React.FC<HorizontalCarouselProps> = ({
  children,
  gap = 2,
  arrows = true,
  sx,
  trackSx,
  arrowSx,
  className,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  // Cached scroll distance (px) for one arrow click = first child's
  // offsetWidth plus the CSS gap (offsetWidth excludes gap).
  const stepWidthRef = useRef(0);

  const recomputeScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    // Allow a 1px slop for sub-pixel rounding.
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft < maxScroll - 1);
  }, []);

  const measureStep = useCallback(() => {
    const el = trackRef.current;
    if (!el || el.children.length === 0) {
      stepWidthRef.current = 0;
      return;
    }
    const first = el.children[0] as HTMLElement;
    stepWidthRef.current = first.offsetWidth + gap;
  }, [gap]);

  // Re-measure step width whenever children or gap change.
  useEffect(() => {
    measureStep();
    recomputeScrollState();
  }, [measureStep, recomputeScrollState, children]);

  // Wire up scroll + resize listeners for arrow visibility.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    recomputeScrollState();
    el.addEventListener("scroll", recomputeScrollState, { passive: true });
    window.addEventListener("resize", recomputeScrollState);
    return () => {
      el.removeEventListener("scroll", recomputeScrollState);
      window.removeEventListener("resize", recomputeScrollState);
    };
  }, [recomputeScrollState]);

  // Re-measure when children grow/shrink (e.g. status text changes
  // width after a chip's body content updates).
  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      measureStep();
      recomputeScrollState();
    });
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [measureStep, recomputeScrollState]);

  const scrollOne = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const distance =
      stepWidthRef.current > 0 ? stepWidthRef.current : el.clientWidth;
    el.scrollBy({ left: direction * distance, behavior: "smooth" });
  };

  // Avoid double-wrapping single-child call sites.
  const items = Children.toArray(children);

  return (
    <Box
      className={className}
      sx={{
        position: "relative",
        width: "100%",
        ...sx,
      }}
    >
      <Box
        ref={trackRef}
        sx={{
          display: "flex",
          flexDirection: "row",
          // `flex-start` so a tall child (e.g. an expanded accordion)
          // doesn't stretch its shorter siblings to match its height.
          alignItems: "flex-start",
          gap: gap,
          overflowX: "auto",
          scrollBehavior: "smooth",
          scrollSnapType: "x mandatory",
          "& > *": {
            flexShrink: 0,
            scrollSnapAlign: "start",
          },
          // Hide the native scrollbar - the arrows replace it.
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
          ...trackSx,
        }}
      >
        {items}
      </Box>

      {arrows && canScrollLeft && (
        <IconButton
          aria-label="scroll left"
          onClick={() => scrollOne(-1)}
          sx={{
            position: "absolute",
            top: "50%",
            left: 4,
            transform: "translateY(-50%)",
            backgroundColor: "background.paper",
            boxShadow: 2,
            "&:hover": { backgroundColor: "background.paper" },
            zIndex: 1,
            ...arrowSx,
          }}
        >
          <ChevronLeftIcon />
        </IconButton>
      )}
      {arrows && canScrollRight && (
        <IconButton
          aria-label="scroll right"
          onClick={() => scrollOne(1)}
          sx={{
            position: "absolute",
            top: "50%",
            right: 4,
            transform: "translateY(-50%)",
            backgroundColor: "background.paper",
            boxShadow: 2,
            "&:hover": { backgroundColor: "background.paper" },
            zIndex: 1,
            ...arrowSx,
          }}
        >
          <ChevronRightIcon />
        </IconButton>
      )}
    </Box>
  );
};

export default HorizontalCarousel;
