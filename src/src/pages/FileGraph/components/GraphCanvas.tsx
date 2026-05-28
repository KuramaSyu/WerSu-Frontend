import { Box } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import type React from "react";
import type { GraphEdge, GraphNode } from "../types";

/**
 * Props for `GraphCanvas`.
 */
export interface GraphCanvasProps {
  /** Callback used to capture the container element for resize calculations. */
  containerRef: (element: HTMLDivElement | null) => void;
  /** SVG ref for pointer capture and coordinate calculations. */
  svgRef: React.RefObject<SVGSVGElement | null>;
  /** Theme used for colors. */
  theme: Theme;
  /** Graph nodes indexed by id. */
  nodes: Map<string, GraphNode>;
  /** Flattened node list for render order. */
  nodeList: GraphNode[];
  /** Graph edges to render. */
  edges: GraphEdge[];
  /** Optional set of node ids connected to the selected node. */
  connectedNodeIds: Set<string> | null;
  /** Id of the selected node. */
  selectedNodeId: string | null;
  /** Id of the selected edge. */
  selectedEdgeId: string | null;
  /** Whether draw mode is active. */
  drawMode: boolean;
  /** Node the draw line starts from, if any. */
  linkingFromNode?: GraphNode;
  /** Current pointer position in graph space while drawing. */
  linkPointer?: { x: number; y: number } | null;
  /** True when the canvas is currently panning. */
  isPanning: boolean;
  /** SVG transform string that includes translate/scale. */
  viewportTransform: string;
  /** Mouse wheel zoom handler. */
  onWheel: React.WheelEventHandler<SVGSVGElement>;
  /** Pointer down handler for panning. */
  onPointerDown: React.PointerEventHandler<SVGSVGElement>;
  /** Pointer move handler for panning or drawing. */
  onPointerMove: React.PointerEventHandler<SVGSVGElement>;
  /** Pointer up handler for panning or drawing. */
  onPointerUp: React.PointerEventHandler<SVGSVGElement>;
  /** Pointer down handler for node draw start. */
  onNodePointerDown: (event: React.PointerEvent, node: GraphNode) => void;
  /** Click handler for selecting nodes. */
  onNodeClick: (node: GraphNode) => void;
  /** Double click handler for navigating to nodes. */
  onNodeDoubleClick: (node: GraphNode) => void;
  /** Click handler for selecting edges. */
  onEdgeClick: (edge: GraphEdge) => void;
}

/**
 * Renders the interactive SVG graph canvas.
 */
export function GraphCanvas(props: GraphCanvasProps): React.ReactElement {
  const {
    containerRef,
    svgRef,
    theme,
    nodes,
    nodeList,
    edges,
    connectedNodeIds,
    selectedNodeId,
    selectedEdgeId,
    drawMode,
    linkingFromNode,
    linkPointer,
    isPanning,
    viewportTransform,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onNodePointerDown,
    onNodeClick,
    onNodeDoubleClick,
    onEdgeClick,
  } = props;

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        borderRadius: 4,
        border: `1px solid ${theme.palette.divider}`,
        background: `radial-gradient(circle at center, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 70%)`,
      }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
      >
        <g transform={viewportTransform}>
          <g>
            {edges.map((edge) => {
              const isConnected = connectedNodeIds
                ? connectedNodeIds.has(edge.sourceId) ||
                  connectedNodeIds.has(edge.targetId)
                : true;
              return (
                <line
                  key={edge.id}
                  x1={nodes.get(edge.sourceId)?.x ?? 0}
                  y1={nodes.get(edge.sourceId)?.y ?? 0}
                  x2={nodes.get(edge.targetId)?.x ?? 0}
                  y2={nodes.get(edge.targetId)?.y ?? 0}
                  onClick={() => onEdgeClick(edge)}
                  stroke={
                    edge.type === "directory"
                      ? theme.palette.primary.main
                      : theme.palette.secondary.main
                  }
                  strokeOpacity={
                    selectedEdgeId === edge.id ? 0.9 : isConnected ? 0.35 : 0.08
                  }
                  strokeWidth={2}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
          </g>
          {drawMode && linkingFromNode && linkPointer && (
            <g>
              <line
                x1={linkingFromNode.x}
                y1={linkingFromNode.y}
                x2={linkPointer.x}
                y2={linkPointer.y}
                stroke={theme.palette.text.primary}
                strokeOpacity={0.6}
                strokeWidth={2}
                strokeDasharray="6 4"
              />
            </g>
          )}
          <g>
            {nodeList.map((node) => (
              <g
                key={node.id}
                onPointerDown={(event) => onNodePointerDown(event, node)}
                onClick={() => onNodeClick(node)}
                onDoubleClick={() => onNodeDoubleClick(node)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius}
                  fill={
                    node.type === "directory"
                      ? theme.palette.primary.main
                      : theme.palette.secondary.main
                  }
                  opacity={
                    selectedNodeId === node.id
                      ? 1
                      : connectedNodeIds
                        ? connectedNodeIds.has(node.id)
                          ? 0.85
                          : 0.15
                        : 0.85
                  }
                  stroke={
                    selectedNodeId === node.id
                      ? theme.palette.text.primary
                      : "transparent"
                  }
                  strokeWidth={2}
                />
                <text
                  x={node.x}
                  y={node.y + node.radius + 14}
                  textAnchor="middle"
                  fontSize="12"
                  fill={theme.palette.text.primary}
                  opacity={
                    connectedNodeIds
                      ? connectedNodeIds.has(node.id)
                        ? 1
                        : 0.3
                      : 1
                  }
                >
                  {node.label.length > 18
                    ? `${node.label.slice(0, 16)}…`
                    : node.label}
                </text>
                <title>{node.label}</title>
              </g>
            ))}
          </g>
        </g>
      </svg>
    </Box>
  );
}
