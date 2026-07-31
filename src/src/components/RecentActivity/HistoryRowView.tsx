import { Box, Stack, Tooltip, Typography } from "@mui/material";
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
  getHistoryRowVariantLabel,
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
  /**
   * What the header line should display.
   *
   * - `"variantLabel"` (default) — the action label only
   *   (`Created a Note`, `Created a Share`, etc.). Used by the
   *   Recent Activity panel where the action verb is the primary
   *   signal.
   * - `"entityTitle"` — the resolved note / directory title
   *   instead. Used by the Frequently Used panel where the user
   *   wants to see which note is at the top.
   */
  headerMode?: "variantLabel" | "entityTitle";
  /**
   * When `true`, wrap the row in a `Tooltip` that dumps the raw
   * entry as JSON. Off by default — only useful while debugging
   * and gated behind the `DeveloperMode` feature flag.
   *
   * The caller is expected to read the flag from
   * `useFeatureStore` and pass it down; the view itself stays
   * store-free so it stays trivially testable.
   */
  developerMode?: boolean;
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
 * undefined. `headerMode` defaults to `"variantLabel"`.
 *
 * Frequently Used panel: pass an entry derived from
 * `ActivityScoreReply` with the looked-up title; the chip renders
 * the aggregated score and the flame icon is used because
 * `getHistoryRowKind` returns `trending`. Set
 * `headerMode="entityTitle"` so the header shows the note title
 * rather than a "Frequently used" label.
 */
export const HistoryRowView: React.FC<HistoryRowViewProps> = ({
  entry,
  onClick,
  headerMode = "variantLabel",
  developerMode = false,
}) => {
  const kind: HistoryRowKind = getHistoryRowKind(entry);
  const { theme } = useThemeStore();

  // Outer Tooltip is the raw-JSON debug surface. Only wrap when the
  // caller has opted in via `developerMode`; production users should
  // never see it.
  const row = (
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
          {/* Header: variant label by default (e.g. "Created a Note"),
              or the resolved entity title when the caller opted into
              `headerMode="entityTitle"` (Frequently Used panel). */}
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {headerMode === "entityTitle"
              ? (entry.title ?? formatHistoryRowLabel(entry))
              : getHistoryRowVariantLabel(entry)}
          </Typography>
          {/* Description: the resolved entity title — note title or
              directory display_name. Older records without a snapshot
              fall through `formatHistoryRowLabel` which never returns
              a raw id; the line is simply absent when nothing is known. */}
          {(entry.description ?? formatHistoryRowLabel(entry)) && (
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
              {entry.description ?? formatHistoryRowLabel(entry)}
            </Typography>
          )}
          {/* Date: plain caption line. Always shown when an `at`
              timestamp is available, independent of the description
              above, so the user always sees when the action happened. */}
          {entry.at && (
            <Typography variant="caption" color="textSecondary">
              {formatHistoryRowTimestamp(entry.at)}
            </Typography>
          )}
        </Box>
        {/* {hasScore(entry) && (
            <Chip size="small" label={entry.score} sx={{ alignSelf: "center" }} />
          )} */}
    </Stack>
  );
  return developerMode ? (
    <Tooltip title={JSON.stringify(entry)} placement="right">
      {row}
    </Tooltip>
  ) : (
    row
  );
};
