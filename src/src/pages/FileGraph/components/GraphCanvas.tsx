import { Box } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, {
  type ForceGraphMethods,
  type LinkObject,
  type NodeObject,
} from "react-force-graph-2d";
import {
  getConnectedNodeIds,
  type GraphData,
  type GraphLink,
  type GraphNode,
  noteColor,
} from "../../../utils/fileGraphUtils";

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
}

/** Paints one node. Dims unconnected / filtered-out nodes. */
function paintNode(
  ctx: CanvasRenderingContext2D,
  node: FGNode,
  theme: Theme,
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
    ctx.strokeStyle = theme.palette.text.primary;
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
    ctx.fillStyle = theme.palette.text.primary;
    ctx.textAlign = "center";
    ctx.fillText(truncate(node.label, 16), x, y + radius + 10);
  }
  ctx.globalAlpha = 1;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Force-graph canvas for directories and notes. Hover-to-highlight, click-to-select.
 */
export function GraphCanvas(props: GraphCanvasProps): React.ReactElement {
  const { theme, data, visibleNodeIds, selectedNodeId, onSelectNode } = props;

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

  const directoryColor = theme.palette.primary.main;
  const noteBaseColor = theme.palette.secondary.main;

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

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        minHeight: 0,
        minWidth: 0,
        borderRadius: 4,
        border: `1px solid ${theme.palette.divider}`,
        background: `radial-gradient(circle at center, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 70%)`,
      }}
    >
      {size.width > 0 && size.height > 0 && (
        <Box sx={{ position: "absolute", inset: 0 }}>
          <ForceGraph2D
            ref={fgRef}
            width={size.width}
            height={size.height}
            graphData={stableData}
            backgroundColor="transparent"
            cooldownTime={1500}
            warmupTicks={60}
            enableZoomInteraction
            enablePanInteraction
            nodeRelSize={3}
            nodeCanvasObjectMode={() => "replace"}
            nodeCanvasObject={(node, ctx, globalScale) => {
              paintNode(
                ctx,
                node,
                theme,
                noteBaseColor,
                visibleNodeIds,
                connectedIds,
                selectedNodeId,
                hoveredId === node.id,
              );
            }}
            linkColor={(link) => {
              const visible =
                visibleNodeIds.has((link as FGLink).source as string) &&
                visibleNodeIds.has((link as FGLink).target as string);
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
