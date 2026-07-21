import { Box, Fab, Tooltip } from "@mui/material";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import type { Theme } from "@mui/material/styles";
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, {
  type ForceGraphMethods,
  type LinkObject,
  type NodeObject,
} from "react-force-graph-2d";
import { forceCollide, forceLink, forceManyBody } from "d3-force-3d";
import {
  getConnectedNodeIds,
  type GraphData,
  type GraphLink,
  type GraphNode,
  noteColor,
} from "../../../utils/fileGraphUtils";
import { forceConfig, graphPalette, renderConfig } from "../graphConfig";

/** Force-graph node with id-only typing (the lib treats nodes as opaque). */
type FGNode = NodeObject<GraphNode>;

/** Force-graph link — `source`/`target` resolved to refs by the sim. */
type FGLink = LinkObject<GraphNode, GraphLink>;

/** Props for `GraphCanvas`. */
export interface GraphCanvasProps {
  /** Theme used for colors. */
  theme: Theme;
  /** Graph payload (nodes + links). */
  data: GraphData;
  /** Visible-set filter returned by the parent (mode + depth). */
  visibleNodeIds: Set<string>;
  /** Currently selected node id. */
  selectedNodeId: string | null;
  /** Selection callback fired on click. */
  onSelectNode: (node: GraphNode) => void;
  /**
   * Re-anchor key — when this string changes, the view recenters and
   * zooms-to-fit on the rendered subgraph. The parent rebuilds it
   * whenever `mode` or `depth` changes (NOT when the selection
   * changes — selection-triggered reanchoring lives behind the
   * manual "anchor" button instead).
   */
  focusKey?: string;
}

/**
 * Default no-op focus key used when callers don't pass one. Keeps the
 * recenter effect stable across renders when the parent has nothing
 * to focus (e.g. the very first mount).
 */
const NO_FOCUS_KEY = "__no_focus__";

/**
 * Coerces a link endpoint (string id, number id, or node-object
 * reference) back to its string id. Used wherever we walk `links`
 * after `react-force-graph-2d` has rewritten `source`/`target` to
 * node-object references — without this we'd be comparing string ids
 * against object references and the BFS / link filter would silently
 * return nothing.
 */
const linkEndpointId = (endpoint: GraphLink["source"]): string => {
  if (typeof endpoint === "string") return endpoint;
  if (typeof endpoint === "number") return String(endpoint);
  return (endpoint as { id?: string }).id ?? "";
};

/** Paints one node. Dims unconnected / filtered-out nodes. */
function paintNode(
  ctx: CanvasRenderingContext2D,
  node: FGNode,
  textColor: string,
  directoryColor: string,
  visible: Set<string>,
  connected: Set<string> | null,
  selectedId: string | null,
  hovered: boolean,
): void {
  const radius = node.type === "directory" ? 5 : 2.5;
  const x = node.x ?? 0;
  const y = node.y ?? 0;

  const isVisible = visible.has(node.id);
  const isConnected = connected ? connected.has(node.id) : true;
  const isSelected = selectedId === node.id;

  const baseAlpha = isVisible
    ? isConnected || connected === null
      ? 0.9
      : 0.12
    : 0.04;
  ctx.globalAlpha = baseAlpha;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fillStyle =
    node.type === "directory"
      ? directoryColor
      : noteColor(node, directoryColor);
  ctx.fill();

  if (isSelected || hovered) {
    ctx.lineWidth = isSelected ? 2 : 1.25;
    ctx.strokeStyle = textColor;
    ctx.stroke();
  }

  // Labels only for directories — notes stay as unlabeled dots.
  if (node.type === "directory") {
    ctx.globalAlpha = isVisible
      ? isConnected || connected === null
        ? 1
        : 0.3
      : 0.05;
    ctx.font = "11px sans-serif";
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.fillText(truncate(node.label, 16), x, y + radius + 10);
  }
  ctx.globalAlpha = 1;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Compute the (x, y) coordinate to center the camera on: the selected
 * node if present, otherwise (0, 0).
 */
function pickAnchor(
  selectedNodeId: string | null,
  data: GraphData,
): { x: number; y: number } | null {
  if (selectedNodeId) {
    const center = data.nodes.find((n) => n.id === selectedNodeId) as
      | FGNode
      | undefined;
    if (
      center &&
      typeof center.x === "number" &&
      typeof center.y === "number"
    ) {
      return { x: center.x, y: center.y };
    }
  }
  return { x: 0, y: 0 };
}

/**
 * Force-graph canvas for directories and notes. Hover-to-highlight, click-to-select.
 *
 * The view re-anchors automatically when `mode` or `depth` changes
 * (via `focusKey`). Reanchoring on selection is deliberate — users
 * have complained that auto-zooming on every click feels jumpy. To
 * recenter on the current selection, click the anchor button in the
 * canvas's top-right corner.
 */
export function GraphCanvas(props: GraphCanvasProps): React.ReactElement {
  const {
    theme,
    data,
    visibleNodeIds,
    selectedNodeId,
    onSelectNode,
    focusKey,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const fgRef = useRef<ForceGraphMethods<FGNode, FGLink> | undefined>(
    undefined,
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const update = (): void => {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The force renderer mutates node positions in place. Keep one stable
  // array so updating selection/highlight does not restart the simulation.
  const stableData: GraphData = useMemo(() => data, [data]);

  // Pull every tunable knob out of `graphConfig.ts`. The palette is
  // derived from the theme so a re-theme flows through here
  // automatically; the force / render numbers are static.
  const palette = useMemo(() => graphPalette(theme), [theme]);
  const directoryColor = palette.directory;
  const noteBaseColor = palette.noteBase;

  // Connected-set for hover highlight. Empty while nothing is hovered.
  const connectedIds = useMemo(() => {
    return hoveredId ? getConnectedNodeIds(hoveredId, stableData.links) : null;
  }, [hoveredId, stableData.links]);

  const handleNodeHover = (node: FGNode | null): void => {
    setHoveredId(node?.id ?? null);
  };

  const handleNodeClick = (node: FGNode): void => {
    onSelectNode(node);
  };

  // Tighten the default d3-force layout once the simulation is available.
  // d3's defaults (charge -30, link distance 30, no collide) produce a
  // very airy graph; we override with the values from `forceConfig`
  // (see `graphConfig.ts` for the rationale on each number).
  // Any field set to `undefined` in `forceConfig` is left at d3's
  // default — we skip the corresponding setter so the library value
  // is preserved. `react-force-graph-2d` sets `node.index` on each
  // node during init, so the default link `id` accessor
  // (`d => d.index`) keeps resolving source/target correctly.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    // Charge (per-node repulsion).
    if (forceConfig.chargeStrength !== undefined) {
      fg.d3Force(
        "charge",
        forceManyBody().strength(forceConfig.chargeStrength),
      );
    }

    // Link spring (distance + stiffness).
    if (
      forceConfig.linkDistance !== undefined ||
      forceConfig.linkStrength !== undefined
    ) {
      const link = forceLink();
      if (forceConfig.linkDistance !== undefined) {
        link.distance(forceConfig.linkDistance);
      }
      if (forceConfig.linkStrength !== undefined) {
        link.strength(forceConfig.linkStrength);
      }
      fg.d3Force("link", link);
    }

    // Collide (per-node keep-out). `undefined` skips the force so
    // d3's "no collide" default is preserved.
    if (forceConfig.collideRadius !== undefined) {
      fg.d3Force("collide", forceCollide().radius(forceConfig.collideRadius));
    }

    fg.d3ReheatSimulation();
  }, []);

  // Anchor routine shared by the auto-focus effect (mode / depth
  // changes) and the manual "anchor" button. Centers on the selected
  // node if any, then zoom-to-fit on the subgraph. Durations and
  // padding come from `renderConfig` (see `graphConfig.ts`).
  const anchorOnSelection = (): void => {
    const fg = fgRef.current;
    if (!fg) return;
    const anchor = pickAnchor(selectedNodeId, stableData);
    if (anchor) {
      fg.centerAt(anchor.x, anchor.y, renderConfig.anchorDurationMs);
    }
    fg.zoomToFit(
      renderConfig.anchorDurationMs,
      renderConfig.zoomToFitPaddingPx,
    );
  };

  // Auto-reanchor when the focus key changes. Note: selection
  // changes are deliberately NOT part of the key — reanchoring on
  // every click was too jumpy. The user explicitly reanchors via
  // the button instead. Skipped on the very first mount
  // (NO_FOCUS_KEY) to avoid a jump while the initial simulation is
  // still warming up.
  useEffect(() => {
    const key = focusKey ?? NO_FOCUS_KEY;
    if (key === NO_FOCUS_KEY) return;
    anchorOnSelection();
    // anchorOnSelection reads selectedNodeId + stableData, but we
    // intentionally only fire on focusKey changes. The eslint
    // disable keeps the dep array honest about that contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        height: "100%",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        minHeight: 0,
        minWidth: 0,
        // borderRadius: 4,
        // border: `1px solid ${theme.palette.divider}`,
        background: `radial-gradient(circle at center, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 70%)`,
      }}
    >
      {/* Top-right anchor FAB. Floats over the canvas; clicking it
          recenters + zoom-to-fits on the current selection (or the
          whole graph if nothing's selected). Uses `size="small"` so it
          doesn't dominate the canvas corner. */}
      <Tooltip title="Center view on selection">
        <Fab
          size="small"
          color="primary"
          aria-label="Anchor view"
          onClick={anchorOnSelection}
          sx={{
            position: "absolute",
            top: renderConfig.fabInsetPx,
            right: renderConfig.fabInsetPx,
            zIndex: 1,
          }}
        >
          <CenterFocusStrongIcon />
        </Fab>
      </Tooltip>
      {size.width > 0 && size.height > 0 && (
        <Box sx={{ position: "absolute", inset: 0 }}>
          <ForceGraph2D
            ref={fgRef}
            width={size.width}
            height={size.height}
            graphData={stableData}
            backgroundColor="transparent"
            cooldownTime={renderConfig.cooldownTimeMs}
            warmupTicks={renderConfig.warmupTicks}
            enableZoomInteraction
            enablePanInteraction
            nodeRelSize={3}
            nodeCanvasObjectMode={() => "replace"}
            nodeCanvasObject={(node, ctx, globalScale) => {
              paintNode(
                ctx,
                node,
                palette.text,
                noteBaseColor,
                visibleNodeIds,
                connectedIds,
                selectedNodeId,
                hoveredId === node.id,
              );
            }}
            linkColor={(link) => {
              const visible =
                visibleNodeIds.has(linkEndpointId((link as FGLink).source)) &&
                visibleNodeIds.has(linkEndpointId((link as FGLink).target));
              return (link as FGLink).type === "directory"
                ? directoryColor
                : noteBaseColor;
            }}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={0.95}
            linkWidth={1}
            linkLineDash={(link) =>
              (link as FGLink).type === "directory" ? [] : [3, 3]
            }
            linkCanvasObjectMode={() => "after"}
            onNodeHover={handleNodeHover}
            onNodeClick={handleNodeClick}
            onNodeRightClick={handleNodeClick}
          />
        </Box>
      )}
    </Box>
  );
}
