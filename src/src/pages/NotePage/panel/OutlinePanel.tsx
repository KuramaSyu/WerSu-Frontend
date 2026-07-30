import { List, ListItemButton, ListItemText, Typography } from "@mui/material";
import { useEffect, useState, type MouseEvent } from "react";
import { PanelSection } from "../../../components/Panels/PanelSection";
import {
  useOutlineStore,
  useScrollElementStore,
} from "../../../zustand/outlineStore";

/**
 * Side-panel section listing every heading in the note.
 *
 * Click an entry -> `?section=<slug>` is set via
 * `window.history.replaceState` (avoids HMR "Router inside Router"
 * caused by `useSearchParams` inside a panel-slot component) and the
 * heading smooth-scrolls into view.
 *
 * Scroll the editor -> scroll-spy tints the active row. URL is NOT
 * updated on scroll (only on click).
 *
 * Reverse direction (`?section=` -> scroll) lives in
 * `useScrollToSectionOnLoad`.
 */
const ACTIVE_OFFSET_PX = 16; // band for "in view" scroll-spy

export const OutlinePanel: React.FC = () => {
  const items = useOutlineStore((s) => s.items);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Scroll-spy: rAF-throttled O(headings) walk; picks the last heading
  // whose top is at/above the container's active line.
  useEffect(() => {
    if (items.length === 0) return;
    const scrollContainer = useScrollElementStore.getState().element;
    if (!scrollContainer) return;

    let rafHandle = 0;
    const recompute = () => {
      rafHandle = 0;
      const containerTop = scrollContainer.getBoundingClientRect().top;
      let current: string | null = null;
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top - containerTop;
        if (top <= ACTIVE_OFFSET_PX) current = item.id;
        else break; // document-ordered, can stop
      }
      // Fallback: if no heading has scrolled past the active line
      // (e.g. the user is at the very top of the doc), pick the
      // first heading as the nearest active point going up.
      if (current === null) current = items[0].id;
      setActiveId(current);
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
      <List
        dense
        disablePadding
        sx={{
          // Vertical guide line on the H1 bullet column.
          position: "relative",
          ml: 1.25,
          "&::before": {
            content: '""',
            position: "absolute",
            left: 1,
            top: 8,
            bottom: 8,
            width: 2,
            borderRadius: 1,
            backgroundColor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.18)"
                : "rgba(0,0,0,0.12)",
          },
        }}
      >
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <ListItemButton
              key={item.id}
              dense
              disableGutters
              onClick={(event: MouseEvent<HTMLDivElement>) => {
                event.preventDefault();
                setActiveId(item.id); // instant highlight
                const url = new URL(window.location.href);
                url.searchParams.set("section", item.id);
                window.history.replaceState(null, "", url.toString());
                document.getElementById(item.id)?.scrollIntoView({
                  block: "start",
                  behavior: "smooth",
                });
              }}
              sx={{
                borderRadius: 1,
                // MUI spacing scale: H1=8px, H2=16px, H3=24px.
                // Exponential indent: each level doubles (H1=0, H2=0.5rem,
                // H3=1rem, H4=2rem, H5+=4rem capped). Row-level indent
                // keeps the bullet anchored to text.
                pl: `${Math.min(item.level, 4)}rem`,
                pr: 1,
                py: 0.25,
                "&::before": {
                  content: '""',
                  display: "block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: (theme) =>
                    isActive
                      ? theme.palette.primary.main
                      : theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.35)"
                        : "rgba(0,0,0,0.35)",
                  transition: (theme) =>
                    theme.transitions.create("background-color", {
                      duration: theme.transitions.duration.short,
                    }),
                  flexShrink: 0,
                  ml: 0.5,
                  mr: 1,
                  // Anchor bullet to the row's bottom edge so it
                  // reads as a connector to the next row (-b-b-b-b-)
                  // instead of sitting in the middle of the row.
                  alignSelf: "flex-end",
                  mb: -0.25,
                },
                backgroundColor: isActive
                  ? (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.04)"
                  : "transparent",
              }}
            >
              <ListItemText
                primary={
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{
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
          );
        })}
      </List>
    </PanelSection>
  );
};
