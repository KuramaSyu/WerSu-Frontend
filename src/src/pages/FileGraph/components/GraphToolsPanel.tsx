import { Button, Stack, Typography } from "@mui/material";
import type React from "react";

/**
 * Props for `GraphToolsPanel`.
 */
export interface GraphToolsPanelProps {
  /** Whether draw mode is currently enabled. */
  drawMode: boolean;
  /** Handler to toggle draw mode. */
  onToggleDrawMode: () => void;
  /** Status message shown after link operations. */
  linkStatus: string | null;
}

/**
 * Renders the graph interaction tools (draw mode toggle, status hints).
 */
export function GraphToolsPanel(
  props: GraphToolsPanelProps,
): React.ReactElement {
  const { drawMode, onToggleDrawMode, linkStatus } = props;

  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      <Typography variant="h6">Graph tools</Typography>
      <Button
        variant={drawMode ? "contained" : "outlined"}
        onClick={onToggleDrawMode}
      >
        {drawMode ? "Draw mode on" : "Draw mode"}
      </Button>
      <Typography variant="caption" color="textSecondary">
        Drag from a directory to a note/directory to set the parent.
      </Typography>
      {linkStatus && (
        <Typography variant="caption" color="textSecondary">
          {linkStatus}
        </Typography>
      )}
    </Stack>
  );
}
