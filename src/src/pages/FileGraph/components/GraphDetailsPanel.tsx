import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import type React from "react";
import type { DirectoryReply } from "../../../api/models/directory";
import type { Note } from "../../../api/models/search";
import type { GraphEdge, GraphNode } from "../types";

/**
 * Props for `GraphDetailsPanel`.
 */
export interface GraphDetailsPanelProps {
  /** Selected node from the graph (if any). */
  selectedNode?: GraphNode;
  /** Selected note details (if loaded). */
  selectedNote: Note | null;
  /** Selected directory details (if available). */
  selectedDirectory: DirectoryReply | null;
  /** Whether details are being loaded. */
  isDetailsLoading: boolean;
  /** Selected edge for delete actions (if any). */
  selectedEdge?: GraphEdge;
  /** Handler to delete the selected edge. */
  onDeleteEdge: (edge: GraphEdge) => void;
}

/**
 * Renders metadata and content for the selected node or edge.
 */
export function GraphDetailsPanel(
  props: GraphDetailsPanelProps,
): React.ReactElement {
  const {
    selectedNode,
    selectedNote,
    selectedDirectory,
    isDetailsLoading,
    selectedEdge,
    onDeleteEdge,
  } = props;

  return (
    <Box
      sx={{
        borderRadius: 4,
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
        p: 2,
        overflow: "auto",
      }}
    >
      <Typography variant="h6" sx={{ mb: 1 }}>
        Details
      </Typography>
      <Divider sx={{ mb: 2 }} />
      {!selectedNode ? (
        <Typography variant="body2" color="textSecondary">
          Click a node to see metadata and content.
        </Typography>
      ) : isDetailsLoading ? (
        <Stack spacing={2} sx={{ mt: 2, alignItems: "center" }}>
          <CircularProgress size={24} />
          <Typography variant="body2">Loading details…</Typography>
        </Stack>
      ) : selectedNode.type === "directory" ? (
        <Stack spacing={1}>
          <Typography variant="subtitle1">
            {selectedDirectory?.display_name ||
              selectedDirectory?.name ||
              selectedNode.label}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Directory ID: {selectedNode.id}
          </Typography>
          {selectedDirectory?.description && (
            <Typography variant="body2">
              {selectedDirectory.description}
            </Typography>
          )}
        </Stack>
      ) : selectedNote ? (
        <Stack spacing={1}>
          <Typography variant="subtitle1">{selectedNote.title}</Typography>
          <Typography variant="body2" color="textSecondary">
            Note ID: {selectedNote.id}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Updated: {new Date(selectedNote.updated_at).toLocaleString()}
          </Typography>
          <Divider sx={{ my: 1 }} />
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {selectedNote.content}
          </Typography>
        </Stack>
      ) : (
        <Typography variant="body2" color="textSecondary">
          No details available.
        </Typography>
      )}
      {selectedEdge && (
        <Stack spacing={1} sx={{ mt: 2 }}>
          <Divider />
          <Typography variant="subtitle2">Selected link</Typography>
          <Typography variant="body2" color="textSecondary">
            {selectedEdge.sourceId} → {selectedEdge.targetId}
          </Typography>
          <Button
            variant="outlined"
            color="error"
            onClick={() => onDeleteEdge(selectedEdge)}
          >
            Delete link
          </Button>
        </Stack>
      )}
    </Box>
  );
}
