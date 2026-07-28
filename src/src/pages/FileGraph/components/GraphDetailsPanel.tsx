import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import React from "react";
import type { DirectoryReply } from "../../../api/models/directory";
import type { Note } from "../../../api/models/search";
import type { GraphLink, GraphNode } from "../../../utils/fileGraphUtils";
import { useThemeStore } from "../../../zustand/useThemeStore";

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
  /** Outgoing edges from the selected node (one-way). */
  outgoingLinks: GraphLink[];
  /** All known directories, in the same shape used by the graph. */
  directories: GraphNode[];
  /** Whether the add-parent mutation is currently busy. */
  isMutating: boolean;
  /** Handler for adding a parent to the selected node. */
  onAddParent: (directoryId: string) => void;
  /** Handler for removing a single outgoing edge. */
  onRemoveLink: (link: GraphLink) => void;
  /** Handler to navigate to the full directory / note page. */
  onOpen: (node: GraphNode) => void;
}

/**
 * Renders metadata, content, and link-management actions for the selected node.
 */
export function GraphDetailsPanel(
  props: GraphDetailsPanelProps,
): React.ReactElement {
  const {
    selectedNode,
    selectedNote,
    selectedDirectory,
    isDetailsLoading,
    outgoingLinks,
    directories,
    isMutating,
    onOpen,
    onAddParent,
    onRemoveLink,
  } = props;

  const [pickerValue, setPickerValue] = React.useState<GraphNode | null>(null);

  // Reset the picker whenever the selection changes.
  React.useEffect(() => {
    setPickerValue(null);
  }, [selectedNode?.id]);

  const { theme } = useThemeStore();
  return (
    <Box
      sx={{
        borderRadius: 4,
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: theme.palette.surfaces.panel,
        p: 2,
        overflow: "auto",
      }}
    >
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography variant="h6">Details</Typography>
        {selectedNode && (
          <Button
            size="small"
            variant="text"
            onClick={() => onOpen(selectedNode)}
          >
            Open
          </Button>
        )}
      </Stack>
      <Divider sx={{ mb: 2 }} />

      {!selectedNode ? (
        <Typography variant="body2" color="textSecondary">
          Click a node to see metadata and links.
        </Typography>
      ) : isDetailsLoading ? (
        <Stack spacing={2} sx={{ mt: 2, alignItems: "center" }}>
          <CircularProgress size={24} />
          <Typography variant="body2">Loading details…</Typography>
        </Stack>
      ) : selectedNode.type === "directory" ? (
        <DirectorySummary
          node={selectedNode}
          directory={selectedDirectory}
          outgoingLinks={outgoingLinks}
          directories={directories}
          pickerValue={pickerValue}
          setPickerValue={setPickerValue}
          isMutating={isMutating}
          onAddParent={onAddParent}
          onRemoveLink={onRemoveLink}
        />
      ) : selectedNote ? (
        <NoteSummary
          node={selectedNode}
          note={selectedNote}
          outgoingLinks={outgoingLinks}
          directories={directories}
          pickerValue={pickerValue}
          setPickerValue={setPickerValue}
          isMutating={isMutating}
          onAddParent={onAddParent}
          onRemoveLink={onRemoveLink}
        />
      ) : (
        <Typography variant="body2" color="textSecondary">
          No details available.
        </Typography>
      )}
    </Box>
  );
}

/** Common actions block used by both directory and note summaries. */
interface LinkActionsProps {
  node: GraphNode;
  outgoingLinks: GraphLink[];
  directories: GraphNode[];
  pickerValue: GraphNode | null;
  setPickerValue: (value: GraphNode | null) => void;
  isMutating: boolean;
  onAddParent: (directoryId: string) => void;
  onRemoveLink: (link: GraphLink) => void;
}

function LinkActions(props: LinkActionsProps): React.ReactElement {
  const {
    outgoingLinks,
    directories,
    pickerValue,
    setPickerValue,
    isMutating,
    onAddParent,
    onRemoveLink,
  } = props;

  const currentParentIds = new Set(
    outgoingLinks.map((link) => link.source).filter((id) => id !== ""),
  );

  return (
    <Stack spacing={1} sx={{ mt: 2 }}>
      <Divider />
      <Typography variant="subtitle2">Parents</Typography>

      <Autocomplete<GraphNode>
        size="small"
        options={directories}
        getOptionLabel={(opt) => opt.label}
        value={pickerValue}
        onChange={(_, next) => setPickerValue(next)}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Add parent directory"
            placeholder="Search directories…"
          />
        )}
      />
      <Button
        variant="outlined"
        size="small"
        disabled={!pickerValue || isMutating}
        onClick={() => {
          if (pickerValue) {
            onAddParent(pickerValue.id);
          }
        }}
      >
        Add parent
      </Button>

      {outgoingLinks.length === 0 ? (
        <Typography variant="caption" color="textSecondary">
          No parents yet.
        </Typography>
      ) : (
        <List dense disablePadding>
          {outgoingLinks.map((link) => {
            const parentLabel =
              directories.find((d) => d.id === link.source)?.label ??
              link.source;
            return (
              <ListItem
                key={`${link.source}-${link.target}`}
                disableGutters
                secondaryAction={
                  <Button
                    size="small"
                    color="error"
                    onClick={() => onRemoveLink(link)}
                  >
                    Remove
                  </Button>
                }
              >
                <ListItemText
                  primary={parentLabel}
                  secondary={
                    currentParentIds.has(link.source) ? "direct" : undefined
                  }
                  slotProps={{ primary: { variant: "body2" } }}
                />
              </ListItem>
            );
          })}
        </List>
      )}
    </Stack>
  );
}

function DirectorySummary(props: {
  node: GraphNode;
  directory: DirectoryReply | null;
  outgoingLinks: GraphLink[];
  directories: GraphNode[];
  pickerValue: GraphNode | null;
  setPickerValue: (v: GraphNode | null) => void;
  isMutating: boolean;
  onAddParent: (id: string) => void;
  onRemoveLink: (link: GraphLink) => void;
}): React.ReactElement {
  const {
    node,
    directory,
    outgoingLinks,
    directories,
    pickerValue,
    setPickerValue,
    isMutating,
    onAddParent,
    onRemoveLink,
  } = props;
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle1">
        {directory?.display_name || directory?.name || node.label}
      </Typography>
      <Typography variant="body2" color="textSecondary">
        Directory ID: {node.id}
      </Typography>
      {directory?.description && (
        <Typography variant="body2">{directory.description}</Typography>
      )}
      <LinkActions
        node={node}
        outgoingLinks={outgoingLinks}
        directories={directories}
        pickerValue={pickerValue}
        setPickerValue={setPickerValue}
        isMutating={isMutating}
        onAddParent={onAddParent}
        onRemoveLink={onRemoveLink}
      />
    </Stack>
  );
}

function NoteSummary(props: {
  node: GraphNode;
  note: Note;
  outgoingLinks: GraphLink[];
  directories: GraphNode[];
  pickerValue: GraphNode | null;
  setPickerValue: (v: GraphNode | null) => void;
  isMutating: boolean;
  onAddParent: (id: string) => void;
  onRemoveLink: (link: GraphLink) => void;
}): React.ReactElement {
  const {
    node,
    note,
    outgoingLinks,
    directories,
    pickerValue,
    setPickerValue,
    isMutating,
    onAddParent,
    onRemoveLink,
  } = props;
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle1">{note.title}</Typography>
      <Typography variant="body2" color="textSecondary">
        Note ID: {node.id}
      </Typography>
      <Typography variant="body2" color="textSecondary">
        Updated: {new Date(note.updated_at).toLocaleString()}
      </Typography>
      <Divider sx={{ my: 1 }} />
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
        {note.content}
      </Typography>
      <LinkActions
        node={node}
        outgoingLinks={outgoingLinks}
        directories={directories}
        pickerValue={pickerValue}
        setPickerValue={setPickerValue}
        isMutating={isMutating}
        onAddParent={onAddParent}
        onRemoveLink={onRemoveLink}
      />
    </Stack>
  );
}
