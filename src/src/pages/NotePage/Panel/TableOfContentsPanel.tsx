import {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineItem,
  TimelineSeparator,
} from "@mui/lab";
import {
  Box,
  IconButton,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TocIcon from "@mui/icons-material/Toc";
import { useSearchParams } from "react-router-dom";
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

/** Diameter of a heading node, in px. Must stay larger than the connector. */
const NODE_SIZE_PX = 10;

/**
 * Hairline that links two heading nodes. A bare number in `sx` would be
 * read as px, but spelling the unit out keeps the intent obvious and
 * guarantees it stays thinner than `NODE_SIZE_PX`.
 */
const connectorSx: SxProps<Theme> = {
  width: "2px",
  backgroundColor: (theme) => theme.palette.divider,
};

/**
 * Headings at this level and deeper start collapsed inside their parent,
 * which then gets an expand/collapse control. This is the single knob
 * for the outline's initial density: lower it to hide more.
 */
const AUTO_COLLAPSE_LEVEL = 3;

/** Headings deeper than this are omitted from the outline entirely. */
const MAX_RENDERED_LEVEL = 4;

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

/** Cheap set equality for scroll-spy state, to avoid re-render churn. */
const sameIdSet = (
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
): boolean => {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
};

interface TocNode {
  item: OutlineItem;
  /** Indent depth, relative to the shallowest heading (capped at 4). */
  depth: number;
  parentId: string | null;
  childIds: string[];
}

interface TocTree {
  nodes: Map<string, TocNode>;
  roots: TocNode[];
}

/** Fold the source-ordered outline into a parent/child tree. */
const buildTocTree = (
  items: ReadonlyArray<OutlineItem>,
  minLevel: number,
): TocTree => {
  const nodes = new Map<string, TocNode>();
  const roots: TocNode[] = [];
  const stack: TocNode[] = [];
  for (const item of items) {
    if (item.level > MAX_RENDERED_LEVEL) continue;
    const node: TocNode = {
      item,
      depth: Math.min(item.level - minLevel, 4),
      parentId: null,
      childIds: [],
    };
    // Nearest preceding heading with a strictly lower level is the parent.
    while (
      stack.length > 0 &&
      stack[stack.length - 1].item.level >= item.level
    ) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent) {
      node.parentId = parent.item.id;
      parent.childIds.push(item.id);
    } else {
      roots.push(node);
    }
    nodes.set(item.id, node);
    stack.push(node);
  }
  return { nodes, roots };
};

/** Whether a node's children are hidden until the user opens it. */
const nodeStartsCollapsed = (
  node: TocNode,
  nodes: ReadonlyMap<string, TocNode>,
): boolean => {
  if (node.childIds.length === 0) return false;
  const firstChild = nodes.get(node.childIds[0]);
  return (firstChild?.item.level ?? Infinity) >= AUTO_COLLAPSE_LEVEL;
};

interface TocRowProps {
  item: OutlineItem;
  indent: number;
  isPrimary: boolean;
  isVisible: boolean;
  isFirst: boolean;
  isLast: boolean;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: (id: string, isExpanded: boolean) => void;
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
  hasChildren,
  isExpanded,
  onToggle,
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
          <TimelineConnector sx={connectorSx} />
        )}
        {isFirst && (
          // spacer keeps the dot centered
          <Box sx={{ flexGrow: 1, width: "2px" }} />
        )}
        {/*
         * One node per heading. Three tiers match the row backgrounds:
         * active -> solid primary disc, on-screen -> half-strength disc,
         * off-screen -> hollow outline.
         */}
        <TimelineDot
          sx={{
            // Strip MUI's padding/border/shadow/margin so we control the disc.
            alignSelf: "center",
            m: 0,
            p: 0,
            boxShadow: "none",
            width: NODE_SIZE_PX,
            height: NODE_SIZE_PX,
            borderRadius: "50%",
            backgroundColor: (theme) =>
              isPrimary
                ? theme.palette.primary.main
                : isVisible
                  ? theme.alpha(theme.palette.primary.main, 0.3)
                  : "transparent",
            border: (theme) =>
              `1.5px solid ${
                isPrimary
                  ? theme.palette.primary.main
                  : isVisible
                    ? theme.alpha(theme.palette.primary.main, 0.7)
                    : theme.alpha(theme.palette.text.primary, 0.3)
              }`,
          }}
        />
        {!isLast && (
          // Bottom-half connector (flex-grow:1); see top-half comment.
          <TimelineConnector sx={connectorSx} />
        )}
        {isLast && (
          // Symmetric to first-row spacer.
          <Box sx={{ flexGrow: 1, width: "2px" }} />
        )}
      </TimelineSeparator>
      <TimelineContent sx={{ p: 0, minWidth: 0 }}>
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
            minWidth: 0,
            overflow: "hidden",
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
            sx={{ minWidth: 0, my: 0 }}
            primary={
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  minWidth: 0,
                  // Precomputed indent (each level capped at 4).
                  pl: `${indent}rem`,
                }}
              >
                <Typography
                  variant="body2"
                  noWrap
                  title={item.textContent}
                  sx={{
                    flex: 1,
                    minWidth: 0,
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
                {hasChildren && (
                  <IconButton
                    size="small"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                    aria-expanded={isExpanded}
                    onClick={(event) => {
                      // Toggle only; never scroll or re-highlight the row.
                      event.preventDefault();
                      event.stopPropagation();
                      onToggle(item.id, isExpanded);
                    }}
                    sx={{
                      p: 0.25,
                      ml: 0.5,
                      flexShrink: 0,
                      color: "text.secondary",
                    }}
                  >
                    <ExpandMoreIcon
                      sx={{
                        fontSize: 18,
                        transition: "transform 150ms",
                        transform: isExpanded
                          ? "rotate(0deg)"
                          : "rotate(-90deg)",
                      }}
                    />
                  </IconButton>
                )}
              </Box>
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

  // Headings deeper than `MAX_RENDERED_LEVEL` are never shown.
  const renderableItems = useMemo(
    () => items.filter((item) => item.level <= MAX_RENDERED_LEVEL),
    [items],
  );

  // Precompute minLevel once per items change so per-row indent is
  // O(1) instead of O(N) inside the map (was O(N^2) per render).
  const minLevel = useMemo(() => {
    let min = Infinity;
    for (const it of renderableItems) {
      if (it.level < min) min = it.level;
    }
    return Number.isFinite(min) ? min : 1;
  }, [renderableItems]);

  // Nest the flat outline so a heading can own the rows beneath it.
  const { nodes, roots } = useMemo(
    () => buildTocTree(renderableItems, minLevel),
    [renderableItems, minLevel],
  );

  // `?section=` deep-link target. Read once for expanded-on-load: the
  // panel's own URL sync uses `history.replaceState`, which does not
  // update react-router's params.
  const [searchParams] = useSearchParams();
  const sectionId = searchParams.get("section");

  // Explicit expand/collapse choices; ids without an entry fall back to
  // the automatic rules below.
  const [expandOverrides, setExpandOverrides] = useState<
    ReadonlyMap<string, boolean>
  >(() => new Map());

  // A collapsed node is auto-expanded while the active heading, any
  // on-screen heading, or the deep-linked heading lives inside it, so
  // the section being read reveals itself as the viewport reaches it.
  const autoExpandIds = useMemo(() => {
    const ids = new Set<string>();
    const addChain = (id: string | null | undefined) => {
      let current = id ?? null;
      while (current && nodes.has(current)) {
        ids.add(current);
        current = nodes.get(current)?.parentId ?? null;
      }
    };
    addChain(primaryId);
    for (const id of visibleIds) addChain(id);
    addChain(sectionId);
    return ids;
  }, [primaryId, visibleIds, sectionId, nodes]);

  // Effective expanded set: a user choice wins, then auto-expansion,
  // then the default (nodes whose children start at/under
  // `AUTO_COLLAPSE_LEVEL` render collapsed).
  const expandedIdSet = useMemo(() => {
    const expanded = new Set<string>();
    nodes.forEach((node, id) => {
      if (node.childIds.length === 0) return;
      const override = expandOverrides.get(id);
      if (override !== undefined) {
        if (override) expanded.add(id);
        return;
      }
      if (autoExpandIds.has(id) || !nodeStartsCollapsed(node, nodes)) {
        expanded.add(id);
      }
    });
    return expanded;
  }, [nodes, expandOverrides, autoExpandIds]);

  // Flat list of rows to render, honouring collapsed ancestors.
  const visibleItems = useMemo(() => {
    const rows: OutlineItem[] = [];
    const walk = (id: string) => {
      const node = nodes.get(id);
      if (!node) return;
      rows.push(node.item);
      if (!expandedIdSet.has(id)) return;
      for (const childId of node.childIds) walk(childId);
    };
    for (const root of roots) walk(root.item.id);
    return rows;
  }, [nodes, roots, expandedIdSet]);

  const handleToggle = useCallback((id: string, isExpanded: boolean) => {
    setExpandOverrides((prev) => {
      const next = new Map(prev);
      next.set(id, !isExpanded);
      return next;
    });
  }, []);

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
      const nextPrimary = primary ?? liveItems[0].id;
      setPrimaryId((prev) => (prev === nextPrimary ? prev : nextPrimary));
      setVisibleIds((prev) => (sameIdSet(prev, visible) ? prev : visible));
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

  // Rows appearing or disappearing after an expand/collapse change what
  // counts as active/on-screen, so re-run the spy without a scroll event.
  useEffect(() => {
    requestRecomputeRef.current();
  }, [visibleItems]);

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
      <PanelSection
        title="Table of Contents"
        titleIcon={<TocIcon fontSize="small" />}
        collapsible
        defaultExpanded
      >
        <Typography variant="body2" color="text.secondary">
          No headings yet.
        </Typography>
      </PanelSection>
    );
  }

  return (
    <PanelSection
      title="Table of Contents"
      titleIcon={<TocIcon fontSize="small" />}
      collapsible
      defaultExpanded
    >
      <Timeline
        sx={{
          p: 0,
          m: 0,
          minWidth: 0,

          // Drop the default `::before` spacer (no TimelineOppositeContent).
          [`& .${timelineItemClasses.root}:before`]: {
            display: "none",
          },
        }}
      >
        {visibleItems.map((item, idx) => {
          const node = nodes.get(item.id);
          const hasChildren = (node?.childIds.length ?? 0) > 0;
          return (
            <TocRow
              key={item.id}
              item={item}
              indent={node?.depth ?? 0}
              isPrimary={item.id === primaryId}
              isVisible={visibleIds.has(item.id)}
              isFirst={idx === 0}
              isLast={idx === visibleItems.length - 1}
              hasChildren={hasChildren}
              isExpanded={hasChildren && expandedIdSet.has(item.id)}
              onToggle={handleToggle}
              onActivate={handleActivate}
            />
          );
        })}
      </Timeline>
    </PanelSection>
  );
};
