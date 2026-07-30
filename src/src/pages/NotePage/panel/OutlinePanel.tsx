import {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineItem,
  TimelineSeparator,
} from "@mui/lab";
import { Box, ListItemButton, ListItemText, Typography } from "@mui/material";
import { useEffect, useState, type MouseEvent } from "react";
import { PanelSection } from "../../../components/Panels/PanelSection";
import {
  useOutlineStore,
  useScrollElementStore,
} from "../../../zustand/outlineStore";
import { timelineItemClasses } from "@mui/lab/TimelineItem";

/** Side-panel section listing every heading. Click scrolls; scroll-spy tints. */
const ACTIVE_OFFSET_PX = 16; // band for "in view" scroll-spy

/** Indent depth relative to the shallowest heading on the page (capped at 4). */
const getIndentLevel = (
  items: ReadonlyArray<{ level: number }>,
  item: { level: number },
): number => {
  let minLevel = item.level;
  for (const it of items) {
    if (it.level < minLevel) minLevel = it.level;
  }
  return Math.min(item.level - minLevel, 4);
};

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
  return { primaryId: primary, visibleIds: visible };
};

export const OutlinePanel: React.FC = () => {
  const items = useOutlineStore((s) => s.items);
  // `primaryId` = active heading (bright). `visibleIds` = every on-screen heading.
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [visibleIds, setVisibleIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // rAF-throttled scroll-spy; updates `primaryId` and `visibleIds`.
  useEffect(() => {
    if (items.length === 0) return;
    const scrollContainer = useScrollElementStore.getState().element;
    if (!scrollContainer) return;

    let rafHandle = 0;
    const recompute = () => {
      rafHandle = 0;
      const rect = scrollContainer.getBoundingClientRect();
      const { primaryId: primary, visibleIds: visible } =
        calculateVisibleSections(items, rect.top, rect.bottom);
      // Fallback: at the very top of the doc, no heading is past the active line.
      setPrimaryId(primary ?? items[0].id);
      setVisibleIds(visible);
    };
    const schedule = () => {
      if (rafHandle) return;
      rafHandle = window.requestAnimationFrame(recompute);
    };

    scrollContainer.addEventListener("scroll", schedule, { passive: true });
    recompute(); // seed on items change

    return () => {
      scrollContainer.removeEventListener("scroll", schedule);
      if (rafHandle) window.cancelAnimationFrame(rafHandle);
    };
  }, [items]);

  if (items.length === 0) {
    return (
      <PanelSection title="Outline" collapsible defaultExpanded>
        <Typography variant="body2" color="text.secondary">
          No headings yet.
        </Typography>
      </PanelSection>
    );
  }

  return (
    <PanelSection title="Outline" collapsible defaultExpanded>
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
          const isPrimary = item.id === primaryId;
          const isVisible = visibleIds.has(item.id);
          const isFirst = idx === 0;
          const isLast = idx === items.length - 1;
          return (
            <TimelineItem
              key={item.id}
              sx={{
                // Drop 70px minHeight so row hugs the button height.
                minHeight: 0,
              }}
            >
              <TimelineSeparator>
                {!isFirst && (
                  // Top-half connector (flex-grow:1); pairs with bottom-half to center the dot.
                  <TimelineConnector />
                )}
                {isFirst && (
                  // No top connector on first row -- spacer keeps the dot centered.
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
                    setPrimaryId(item.id); // instant highlight
                    const url = new URL(window.location.href);
                    url.searchParams.set("section", item.id);
                    window.history.replaceState(null, "", url.toString());
                    document.getElementById(item.id)?.scrollIntoView({
                      block: "start",
                      behavior: "smooth",
                    });
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
                          // Exponential indent (each level doubles), capped via getIndentLevel.
                          pl: `${getIndentLevel(items, item)}rem`,
                          fontSize:
                            item.level === 1
                              ? "0.95rem"
                              : item.level === 2
                                ? "0.85rem"
                                : "0.8rem",
                          fontWeight: item.level <= 2 ? 500 : 400,
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
        })}
      </Timeline>
    </PanelSection>
  );
};
