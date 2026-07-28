import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteIcon from "@mui/icons-material/Delete";
import PublishIcon from "@mui/icons-material/Publish";
import ShareIcon from "@mui/icons-material/Share";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import RestoreFromTrashIcon from "@mui/icons-material/RestoreFromTrash";
import InventoryIcon from "@mui/icons-material/Inventory";
import HistoryIcon from "@mui/icons-material/History";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import FolderDeleteIcon from "@mui/icons-material/FolderDelete";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import VpnKeyOffIcon from "@mui/icons-material/VpnKeyOff";
import KeyIcon from "@mui/icons-material/Key";
import { useThemeStore } from "../../zustand/useThemeStore";
import {
  assertExhaustive,
  formatHistoryRowLabel,
  formatHistoryRowTimestamp,
  getHistoryRowKind,
  hasScore,
  type HistoryRowEntry,
  type HistoryRowKind,
} from "./HistoryRowFeatures";

/**
 * Renders the icon element for a row directly.
 *
 * Why a switch returning JSX (rather than a `Record<ActionKind,
 * Component>` + `const Icon = ...; <Icon />`):
 *   1. `eslint-plugin-react-hooks/static-components` bans the latter
 *      because the variable would create a fresh component identity
 *      on every render, defeating React's reconciliation.
 *   2. A `switch` over `ActivityKind` keeps the exhaustiveness
 *      guarantee -- adding a new `ActivityKind` literal fails the
 *      build here too, via `assertExhaustive`.
 */
const renderRowIcon = (entry: HistoryRowEntry): React.ReactNode => {
  if (entry.score !== undefined) {
    return null;
    // return <LocalFireDepartmentIcon fontSize="small" />;
  }
  if (entry.action === undefined) {
    return <EditIcon fontSize="small" />;
  }
  switch (entry.action) {
    case "note_viewed":
      return <VisibilityIcon fontSize="small" />;
    case "note_created":
      return <AddIcon fontSize="small" />;
    case "note_edited":
      return <EditIcon fontSize="small" />;
    case "note_deleted":
      return <DeleteIcon fontSize="small" />;
    case "note_published":
      return <PublishIcon fontSize="small" />;
    case "note_shared":
      return <ShareIcon fontSize="small" />;
    case "note_unshared":
      return <LinkOffIcon fontSize="small" />;
    case "note_restored":
      return <RestoreFromTrashIcon fontSize="small" />;
    case "note_archived":
      return <InventoryIcon fontSize="small" />;
    case "note_version_restored":
      return <HistoryIcon fontSize="small" />;
    case "note_attachment_added":
      return <AttachFileIcon fontSize="small" />;
    case "directory_created":
      return <CreateNewFolderIcon fontSize="small" />;
    case "directory_viewed":
      return <VisibilityIcon fontSize="small" />;
    case "directory_edited":
      return <DriveFileMoveIcon fontSize="small" />;
    case "directory_deleted":
      return <FolderDeleteIcon fontSize="small" />;
    case "role_grant":
      return <VpnKeyIcon fontSize="small" />;
    case "role_revoke":
      return <VpnKeyOffIcon fontSize="small" />;
    case "role_change":
      return <KeyIcon fontSize="small" />;
    default:
      return assertExhaustive(entry.action);
  }
};

export interface HistoryRowViewProps {
  entry: HistoryRowEntry;
  onClick: (entry: HistoryRowEntry) => void;
}

/**
 * Renders a single history-style row.
 *
 * Layout: icon (driven by the variant) + title + relative
 * timestamp on the left, and an optional score chip on the right
 * (the Frequently Used panel's affordance). Click opens the note.
 *
 * Reuse notes
 * -----------
 * Recent Activity panel: pass an entry derived from
 * `ActivityReply`. The chip stays hidden because `score` is
 * undefined.
 *
 * Frequently Used panel: pass an entry derived from
 * `ActivityScoreReply` with the looked-up title; the chip renders
 * the aggregated score and the flame icon is used because
 * `getHistoryRowKind` returns `trending`.
 */
export const HistoryRowView: React.FC<HistoryRowViewProps> = ({
  entry,
  onClick,
}) => {
  const kind: HistoryRowKind = getHistoryRowKind(entry);
  const { theme } = useThemeStore();

  return (
    <Tooltip title={JSON.stringify(entry)} placement="right">
      <Stack
        direction="row"
        spacing={theme.spacing(1)}
        sx={{
          alignItems: "flex-start",
          cursor: "pointer",
          borderRadius: 1,
          px: 1,
          py: 0.5,
          transition: theme.transitions.create(
            ["background-color", "transform"],
            { duration: theme.transitions.duration.short },
          ),
          "&:hover": {
            backgroundColor: theme.palette.action.hover,
          },
        }}
        onClick={() => onClick(entry)}
      >
        <Tooltip title={kind} placement="right">
          <Box sx={{ pt: 0.25, display: "flex", alignItems: "center" }}>
            {renderRowIcon(entry)}
          </Box>
        </Tooltip>
        <Box sx={{ flex: 1, minWidth: 0 }} aria-label={"Creation time"}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {entry.title ?? formatHistoryRowLabel(entry)}
          </Typography>
          {entry.description && (
            <Typography
              variant="caption"
              color="textSecondary"
              sx={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {entry.description}
            </Typography>
          )}
          {!entry.description && entry.at && (
            <Typography variant="caption" color="textSecondary">
              {formatHistoryRowTimestamp(entry.at)}
            </Typography>
          )}
        </Box>
        {/* {hasScore(entry) && (
            <Chip size="small" label={entry.score} sx={{ alignSelf: "center" }} />
          )} */}
      </Stack>
    </Tooltip>
  );
};
