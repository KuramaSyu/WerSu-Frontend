import {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineItem,
  TimelineSeparator,
} from "@mui/lab";
import { Box, ListItemButton, ListItemText, Typography } from "@mui/material";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { PanelSection } from "../../../components/Panels/PanelSection";
import {
  useOutlineStore,
  useScrollElementStore,
  type OutlineItem,
} from "../../../zustand/outlineStore";
import { useEditorSettings } from "../../../zustand/useEditorSettings";
import { timelineItemClasses } from "@mui/lab/TimelineItem";

/** Side-panel section listing every heading. Click scrolls; scroll-spy tints. */
const ACTIVE_OFFSET_PX = 16; // band for "in view" scroll-spy

/**
 * Pick the active heading and every on-screen heading in one pass.
 * `items` must be source-ordered so we can break after the first
 * heading that's below the viewport bottom.
 */
const calculateVisibleSections = (
  items: ReadonlyArray<{ id: string }>,
  containerTop: number,
  containerBottom: number,
): { primaryId: string | null; visibleIds: ReadonlySet<string> } => {
  let primary: string | null = null;
  const visible = new Set<string>();
  for (const item of items) {
    const el = document.getElementById(item.id);
    if (!el) continue;
    const headTop = el.getBoundingClientRect().top;
    // Last heading whose top is at/above the active line wins.
    if (headTop - containerTop <= ACTIVE_OFFSET_PX) primary = item.id;
    // On-screen heading.
    if (headTop >= containerTop && headTop <= containerBottom) {
      visible.add(item.id);
    } else if (headTop > containerBottom) {
      // Past the viewport bottom -> every later heading is also below.
      break;
    }
  }
  // if no primary was found, use the first visible heading as primary (if any)
  if (!primary && visible.size > 0) {
    primary = visible.values().next().value ?? null;
  }
  return { primaryId: primary, visibleIds: visible };
};

interface TocRowProps {
  item: OutlineItem;
  indent: number;
  isPrimary: boolean;
  isVisible: boolean;
  isFirst: boolean;
  isLast: boolean;
  onActivate: (id: string) => void;
}

/**
 * Single TOC row. Memoized so a row's `isPrimary`/`isVisible` flip
 * doesn't cascade through siblings; combined with a stable
 * `onActivate` callback, scrolling the viewport only re-renders the
 * row whose state actually changed.
 */
const TocRow = memo(function TocRow({
  item,
  indent,
  isPrimary,
  isVisible,
  isFirst,
  isLast,
  onActivate,
}: TocRowProps) {
  return (
    <TimelineItem
      sx={{
        // Drop 70px minHeight; otherwise items are miss-aligned
        minHeight: 0,
      }}
    >
      <TimelineSeparator>
        {!isFirst && (
          // Top-half connector (flex-grow:1); pairs with bottom-half to center the dot.
          <TimelineConnector />
        )}
        {isFirst && (
          // spacer keeps the dot centered
          <Box sx={{ flexGrow: 1 }} />
        )}
        <TimelineDot
          color={isPrimary || isVisible ? "primary" : "grey"}
          sx={{
            // Strip defaults (padding/border/shadow/margin) -> clean 1.5px disc.
            m: 0,
            p: 0,
            border: 0,
            boxShadow: "none",
            width: 1.5,
            height: 1.5,
          }}
        />
        {!isLast && (
          // Bottom-half connector (flex-grow:1); see top-half comment.
          <TimelineConnector />
        )}
        {isLast && (
          // Symmetric to first-row spacer.
          <Box sx={{ flexGrow: 1 }} />
        )}
      </TimelineSeparator>
      <TimelineContent sx={{ p: 0 }}>
        <ListItemButton
          dense
          disableGutters
          onClick={(event: MouseEvent<HTMLDivElement>) => {
            event.preventDefault();
            onActivate(item.id);
          }}
          sx={{
            pl: 1,
            borderRadius: 1,
            // Three tiers: primary (strong), visible (40%), off-screen (transparent).
            backgroundColor: isPrimary
              ? (theme) =>
                  theme.alpha(
                    theme.palette.primary.main,
                    theme.palette.action.selectedOpacity,
                  )
              : isVisible
                ? (theme) =>
                    theme.alpha(
                      theme.palette.primary.main,
                      theme.palette.action.selectedOpacity * 0.4,
                    )
                : "transparent",
          }}
        >
          <ListItemText
            primary={
              <Typography
                variant="body2"
                noWrap
                sx={{
                  // Precomputed indent (each level capped at 4).
                  pl: `${indent}rem`,
                  fontSize:
                    item.level === 1
                      ? "0.95rem"
                      : item.level === 2
                        ? "0.85rem"
                        : "0.8rem",
                  fontWeight: isPrimary ? "bold" : "normal",
                  color: isPrimary ? "text.primary" : "text.secondary",
                }}
              >
                {item.textContent}
              </Typography>
            }
          />
        </ListItemButton>
      </TimelineContent>
    </TimelineItem>
  );
});

export const TableOfContentsPanel: React.FC = () => {
  const items = useOutlineStore((s) => s.items);
  // `primaryId` = active heading (bright). `visibleIds` = every on-screen heading.
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [visibleIds, setVisibleIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // Stable ref so the scroll listener never reattaches on items change.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Precompute minLevel once per items change so per-row indent is
  // O(1) instead of O(N) inside the map (was O(N^2) per render).
  const minLevel = useMemo(() => {
    let min = Infinity;
    for (const it of items) {
      if (it.level < min) min = it.level;
    }
    return Number.isFinite(min) ? min : 1;
  }, [items]);

  // Subscribe to the scroll-container ref, not to `items`.
  const scrollContainer = useScrollElementStore((s) => s.element);

  // rAF-throttled scroll-spy; updates `primaryId` and `visibleIds`.
  // The listener is bound to the container only; re-binds on container
  // change. The `itemsRef` lets it read the live list without re-binding.
  const requestRecomputeRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!scrollContainer) return;
    if (itemsRef.current.length === 0) return;

    let rafHandle = 0;
    const recompute = () => {
      rafHandle = 0;
      const liveItems = itemsRef.current;
      if (liveItems.length === 0) {
        setPrimaryId(null);
        setVisibleIds(new Set());
        return;
      }
      const rect = scrollContainer.getBoundingClientRect();
      const { primaryId: primary, visibleIds: visible } =
        calculateVisibleSections(liveItems, rect.top, rect.bottom);
      // Fallback: at the very top of the doc, no heading is past the active line.
      setPrimaryId(primary ?? liveItems[0].id);
      setVisibleIds(visible);
    };
    const schedule = () => {
      if (rafHandle) return;
      rafHandle = window.requestAnimationFrame(recompute);
    };
    requestRecomputeRef.current = schedule;
    scrollContainer.addEventListener("scroll", schedule, { passive: true });
    schedule(); // seed

    return () => {
      scrollContainer.removeEventListener("scroll", schedule);
      if (rafHandle) window.cancelAnimationFrame(rafHandle);
      requestRecomputeRef.current = () => {};
    };
  }, [scrollContainer]);

  // Re-seed when items structurally change (mount, headings added/removed/renamed).
  // Does NOT rebind the scroll listener; just rAF-schedules a recompute.
  useEffect(() => {
    if (!scrollContainer) return;
    if (items.length === 0) {
      setPrimaryId(null);
      setVisibleIds(new Set());
      return;
    }
    requestRecomputeRef.current();
  }, [items, scrollContainer]);

  // Skip the first primaryId change so we don't overwrite a freshly
  // stripped invalid `?section` from `useScrollToSectionOnLoad`.
  const skipNextSyncRef = useRef(true);
  const { editMode } = useEditorSettings();

  // Sync `?section=<primaryId>` via replaceState so the URL tracks the
  // active heading (scroll-spy on scroll, setPrimaryId on click).
  // Disabled in edit mode;
  useEffect(() => {
    if (editMode) return;
    if (!primaryId) return;
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get("section") === primaryId) return;
    url.searchParams.set("section", primaryId);
    window.history.replaceState(null, "", url.toString());
  }, [primaryId, editMode]);

  // Stable per-row click handler. View-mode behavior is identical to
  // before (click highlight + smooth scroll); edit mode only flips the
  // highlight, never moves the view.
  const handleActivate = useCallback(
    (id: string) => {
      setPrimaryId(id);
      if (editMode) return;
      document.getElementById(id)?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    },
    [editMode],
  );

  if (items.length === 0) {
    return (
      <PanelSection title="Table of Contents" collapsible defaultExpanded>
        <Typography variant="body2" color="text.secondary">
          No headings yet.
        </Typography>
      </PanelSection>
    );
  }

  return (
    <PanelSection title="Table of Contents" collapsible defaultExpanded>
      <Timeline
        sx={{
          p: 0,
          m: 0,

          // Drop the default `::before` spacer (no TimelineOppositeContent).
          [`& .${timelineItemClasses.root}:before`]: {
            display: "none",
          },
        }}
      >
        {items.map((item, idx) => {
          if (item.level > 4) {
            return null;
          }
          return (
            <TocRow
              key={item.id}
              item={item}
              indent={Math.min(item.level - minLevel, 4)}
              isPrimary={item.id === primaryId}
              isVisible={visibleIds.has(item.id)}
              isFirst={idx === 0}
              isLast={idx === items.length - 1}
              onActivate={handleActivate}
            />
          );
        })}
      </Timeline>
    </PanelSection>
  );
};
