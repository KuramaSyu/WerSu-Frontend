// ---------------------------------------------------------------------------
// CollabConflictModal
// Shown when the user comes back online after a session that combined
// local edits with server-side edits. Displays side-by-side
// previews: "your version" (local) and "cloud version" (server), with
// a line diff between them. The user picks one of three resolutions:
//
//   - Use cloud: discard local edits, overwrite the local ydoc with
//     the server's content. Useful when the server has authoritative
//     changes the user wants to keep.
//   - Use local: keep local edits, push them to the server via the
//     REST PATCH and discard any server-side changes that landed
//     while we were offline. Useful when the user trusts their
//     local edits more than what arrived on the server.
//   - Cancel: stay in editing-offline mode (the WS is open, but we
//     disconnect again). Lets the user think or copy content out
//     before deciding.
//
// The modal is a presentational component; resolution callbacks are
// passed in by the caller (typically `NoteEditorCore`).
// ---------------------------------------------------------------------------

import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { ModalShell } from "./ModalShell";
import { M2, M3 } from "../statics";
import { useThemeStore } from "../zustand/useThemeStore";
import { buildLineDiff, type DiffLine } from "../hooks/collabReconcile";

export interface CollabConflictModalProps {
  open: boolean;
  /** Markdown produced locally while offline. */
  localMarkdown: string;
  /** Markdown the server had at the moment we went offline. */
  preOfflineCloud: string;
  /** Markdown the server has now (after our reconnect). */
  currentCloud: string;
  /** When the user last edited locally (ms since epoch). */
  lastLocalEditAt: number | null;
  /** When the server's currentCloud was last updated. Optional. */
  currentCloudUpdatedAt?: string | null;
  /** True while a "use cloud" / "use local" mutation is in flight. */
  resolving?: boolean;
  onUseCloud: () => void | Promise<void>;
  onUseLocal: () => void | Promise<void>;
  onCancel: () => void;
}

function formatRelative(ts: number | string | null | undefined): string {
  if (ts === null || ts === undefined || ts === "") return "unknown";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleString();
}

const PreviewPanel: React.FC<{
  title: string;
  body: string;
  diff: DiffLine[];
  color: "added" | "removed" | "unchanged";
  emptyHint?: string;
}> = ({ title, body, diff, emptyHint }) => {
  const { theme } = useThemeStore();
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: M2,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flex: 1,
      }}
    >
      <Box
        sx={{
          px: M2,
          py: 1,
          backgroundColor: theme.palette.background.paper,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="subtitle2" color="textSecondary">
          {title}
        </Typography>
      </Box>
      <Box
        sx={{
          p: M2,
          flex: 1,
          overflow: "auto",
          fontFamily: "monospace",
          whiteSpace: "pre-wrap",
          fontSize: "0.85rem",
          minHeight: 200,
          maxHeight: 360,
        }}
      >
        {body.length === 0 && emptyHint ? (
          <Typography variant="body2" color="textSecondary">
            {emptyHint}
          </Typography>
        ) : (
          diff.map((line, index) => (
            <Box
              key={`${line.kind}-${index}`}
              sx={{
                color:
                  line.kind === "added"
                    ? "success.main"
                    : line.kind === "removed"
                      ? "error.main"
                      : "textSecondary",
              }}
            >
              {line.kind === "added"
                ? "+ "
                : line.kind === "removed"
                  ? "- "
                  : "  "}
              {line.text}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};

export const CollabConflictModal: React.FC<CollabConflictModalProps> = ({
  open,
  localMarkdown,
  preOfflineCloud,
  currentCloud,
  lastLocalEditAt,
  currentCloudUpdatedAt,
  resolving,
  onUseCloud,
  onUseLocal,
  onCancel,
}) => {
  const [tab, setTab] = useState(0);
  // Diff between the user's local markdown and the server's current
  // markdown. We compute it once per open.
  const localVsCurrent = useMemo(
    () => buildLineDiff(localMarkdown, currentCloud),
    [localMarkdown, currentCloud],
  );
  // Diff between the pre-offline cloud snapshot and the current
  // cloud markdown. Highlights what the server changed while we
  // were offline, regardless of local edits.
  const serverDelta = useMemo(
    () => buildLineDiff(preOfflineCloud, currentCloud),
    [preOfflineCloud, currentCloud],
  );

  // The tab's "body" is the text the preview shows. The "diff" is
  // what we color. For "your version" we show local vs current so
  // the user sees the full set of changes; for "cloud version" we
  // show the current cloud and a smaller diff of just the server's
  // contribution.
  const localBody = localMarkdown;
  const cloudBody = currentCloud;

  return (
    <ModalShell
      open={open}
      onClose={resolving ? () => undefined : onCancel}
      icon={
        <CircularProgress
          size={20}
          color="warning"
          variant="determinate"
          value={100}
        />
      }
      title="Sync conflict"
      subtitle="You edited locally and the server changed while you were offline. Choose which version to keep."
      maxWidth="md"
      minHeight="48vh"
      actions={
        <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
          <Button onClick={onCancel} disabled={resolving}>
            Stay offline
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            onClick={onUseCloud}
            disabled={resolving}
            color="error"
            variant="outlined"
          >
            Use cloud version
          </Button>
          <Button
            onClick={onUseLocal}
            disabled={resolving}
            color="primary"
            variant="contained"
          >
            Use local version
          </Button>
        </Stack>
      }
    >
      <Stack spacing={M3} sx={{ minHeight: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Chip
            size="small"
            label={`Your last edit: ${formatRelative(lastLocalEditAt)}`}
            color="primary"
            variant="outlined"
          />
          <Chip
            size="small"
            label={`Server updated: ${formatRelative(currentCloudUpdatedAt)}`}
            color="secondary"
            variant="outlined"
          />
          {resolving && (
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", ml: "auto" }}
            >
              <CircularProgress size={16} />
              <Typography variant="body2" color="textSecondary">
                Applying…
              </Typography>
            </Stack>
          )}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="body2" color="textSecondary">
            Pre-offline server:
          </Typography>
          <Box
            sx={{
              p: 1,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              fontFamily: "monospace",
              fontSize: "0.75rem",
              maxHeight: 80,
              overflow: "auto",
              flex: 1,
              whiteSpace: "pre-wrap",
            }}
          >
            {preOfflineCloud || "(empty)"}
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="caption" color="textSecondary">
            Server-only delta (what changed while you were offline):
          </Typography>
          <Box
            sx={{
              fontFamily: "monospace",
              fontSize: "0.7rem",
              color: "text.secondary",
              flex: 1,
              maxHeight: 60,
              overflow: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {serverDelta.length === 0
              ? "(no server-side changes)"
              : serverDelta
                  .filter((l) => l.kind !== "unchanged")
                  .slice(0, 8)
                  .map((l) =>
                    l.kind === "added" ? `+ ${l.text}` : `- ${l.text}`,
                  )
                  .join("\n")}
          </Box>
        </Stack>

        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="fullWidth"
        >
          <Tab label="Your version" />
          <Tab label="Cloud version" />
        </Tabs>

        {tab === 0 ? (
          <PreviewPanel
            title="Your version (local)"
            body={localBody}
            diff={localVsCurrent}
            color="added"
            emptyHint="No local edits recorded."
          />
        ) : (
          <PreviewPanel
            title="Cloud version (server)"
            body={cloudBody}
            diff={buildLineDiff(localMarkdown, currentCloud).filter(
              (l) => l.kind === "added" || l.kind === "unchanged",
            )}
            color="added"
          />
        )}

        <Typography variant="caption" color="textSecondary">
          <strong>Use cloud version</strong> overwrites your local edits with
          the server's current content. <strong>Use local version</strong> saves
          your local edits to the server and discards any server-side changes
          that arrived while you were offline.
        </Typography>
      </Stack>
    </ModalShell>
  );
};
