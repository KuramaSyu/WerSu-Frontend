import {
  Box,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type React from "react";

/** Graph visualization mode. */
export type GraphMode = "global" | "local";

/**
 * Props for `GraphToolsPanel`.
 */
export interface GraphToolsPanelProps {
  /** Current view mode (global vs local). */
  mode: GraphMode;
  /** Handler to change view mode. */
  onModeChange: (mode: GraphMode) => void;
  /** Local-graph depth (only relevant when `mode === 'local'`). */
  depth: number;
  /** Handler to change depth. */
  onDepthChange: (depth: number) => void;
  /** Optional status line for the previous link action. */
  linkStatus: string | null;
}

/**
 * Renders the graph interaction tools (mode toggle + depth slider).
 * No more drag-to-link — link editing happens via the details panel.
 */
export function GraphToolsPanel(
  props: GraphToolsPanelProps,
): React.ReactElement {
  const { mode, onModeChange, depth, onDepthChange, linkStatus } = props;

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Graph view</Typography>

      <Box>
        <Typography variant="caption" color="textSecondary">
          Mode
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          fullWidth
          value={mode}
          onChange={(_, next: GraphMode | null) => next && onModeChange(next)}
          sx={{ mt: 0.5 }}
        >
          <ToggleButton value="global">Global</ToggleButton>
          <ToggleButton value="local">Local</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {mode === "local" && (
        <Box>
          <Typography variant="caption" color="textSecondary">
            Depth
          </Typography>
          <Slider
            size="small"
            value={depth}
            min={1}
            max={5}
            step={1}
            marks
            valueLabelDisplay="auto"
            onChange={(_, value) =>
              onDepthChange(Array.isArray(value) ? value[0] : value)
            }
          />
        </Box>
      )}

      {linkStatus && (
        <Typography variant="caption" color="textSecondary">
          {linkStatus}
        </Typography>
      )}

      <Typography variant="caption" color="textSecondary">
        Tip: click a node to select, then press "Open" in the details panel.
      </Typography>
    </Stack>
  );
}
