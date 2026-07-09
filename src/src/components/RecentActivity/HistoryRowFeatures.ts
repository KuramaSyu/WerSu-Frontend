import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
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
import { queryClient } from "../../api/queryClient";
import { Note } from "../../api/models/search";
import type {
  AccessedAs,
  ActivityKind,
  HistoryFilter,
} from "../../api/models/history";
import { useActivityHistory } from "../../api/queries/historyQueries";
import { crumble } from "../../utils/stringCrumbler";

/** Cap on the description preview rendered per history row. */
const HISTORY_ROW_DESCRIPTION_CAP = 120;

/** Row shape consumed by `HistoryRowView`; mirrors the union of `ActivityReply` and `ActivityScoreReply`, plus optional `score` for the Frequently Used panel. */
export interface HistoryRowEntry {
  /** Note id the row refers to. Required. */
  note_id: string;

  /** Activity event id; optional. */
  id?: string;
  /** User id that performed the action; optional. */
  actor_id?: string;
  /** How the actor was acting; optional. */
  accessed_as?: AccessedAs;
  /** Event kind; optional. */
  action?: ActivityKind;
  /** Directory id the event targeted; optional. */
  directory_id?: string;
  /** Role id the event targeted; optional. */
  role_id?: string;
  /** RFC3339 timestamp; optional (most-used rows do not emit one). */
  at?: string;
  /** JSON-encoded payload; optional. */
  metadata_json?: string;

  /** Most-used score; populated only for `mode=most_used` rows. */
  score?: number;

  /** Pre-rendered note title; optional. */
  title?: string;
  /** Pre-rendered description preview; optional. */
  description?: string;
}

/** Visual variant of a row; each `ActivityKind` maps to its own variant so the panel can render distinct icons + labels + colours. `trending` is the score-bearing variant, `unknown` is the no-action fallback. */
export type HistoryRowKind =
  | "created"
  | "edited"
  | "viewed"
  | "deleted"
  | "published"
  | "shared"
  | "unshared"
  | "restored"
  | "archived"
  | "version_restored"
  | "attachment_added"
  | "directory_created"
  | "directory_viewed"
  | "directory_edited"
  | "directory_deleted"
  | "role_granted"
  | "role_revoked"
  | "role_changed"
  | "trending"
  | "unknown";

/** Per-variant display metadata; centralised so icon / label changes happen in one place. `color` is a MUI palette key so it re-themes with the rest of the app. */
export interface HistoryRowVariantMeta {
  /** MUI icon component. */
  icon: React.ComponentType<{ fontSize?: "small" | "medium" | "large" }>;
  /** Short caption rendered alongside the note title (e.g. "Edited"). */
  label: string;
  /** MUI palette key for the icon's `color` prop. */
  color: "primary" | "secondary" | "success" | "warning" | "info" | "error";
}

export const VARIANT_META: Record<HistoryRowKind, HistoryRowVariantMeta> = {
  created: { icon: AddIcon, label: "Created", color: "success" },
  edited: { icon: EditIcon, label: "Edited", color: "info" },
  viewed: { icon: VisibilityIcon, label: "Viewed", color: "info" },
  deleted: { icon: DeleteIcon, label: "Deleted", color: "error" },
  published: { icon: PublishIcon, label: "Published", color: "primary" },
  shared: { icon: ShareIcon, label: "Shared", color: "primary" },
  unshared: { icon: LinkOffIcon, label: "Unshared", color: "warning" },
  restored: { icon: RestoreFromTrashIcon, label: "Restored", color: "success" },
  archived: { icon: InventoryIcon, label: "Archived", color: "warning" },
  version_restored: {
    icon: HistoryIcon,
    label: "Version restored",
    color: "success",
  },
  attachment_added: {
    icon: AttachFileIcon,
    label: "Attachment added",
    color: "info",
  },
  directory_created: {
    icon: CreateNewFolderIcon,
    label: "Directory created",
    color: "success",
  },
  directory_viewed: {
    icon: VisibilityIcon,
    label: "Directory viewed",
    color: "info",
  },
  directory_edited: {
    icon: DriveFileMoveIcon,
    label: "Directory edited",
    color: "info",
  },
  directory_deleted: {
    icon: FolderDeleteIcon,
    label: "Directory deleted",
    color: "error",
  },
  role_granted: { icon: VpnKeyIcon, label: "Role granted", color: "success" },
  role_revoked: { icon: VpnKeyOffIcon, label: "Role revoked", color: "error" },
  role_changed: { icon: KeyIcon, label: "Role changed", color: "warning" },
  trending: {
    icon: LocalFireDepartmentIcon,
    label: "Frequently used",
    color: "warning",
  },
  unknown: { icon: EditIcon, label: "Activity", color: "info" },
};

/** Maps every `ActivityKind` literal to its canonical `HistoryRowKind`; single source of truth for the view and helpers. */
export const ACTION_VARIANT: Record<ActivityKind, HistoryRowKind> = {
  note_viewed: "viewed",
  note_created: "created",
  note_edited: "edited",
  note_deleted: "deleted",
  note_published: "published",
  note_shared: "shared",
  note_unshared: "unshared",
  note_restored: "restored",
  note_archived: "archived",
  note_version_restored: "version_restored",
  note_attachment_added: "attachment_added",
  directory_created: "directory_created",
  directory_viewed: "directory_viewed",
  directory_edited: "directory_edited",
  directory_deleted: "directory_deleted",
  role_grant: "role_granted",
  role_revoke: "role_revoked",
  role_change: "role_changed",
};

/** Exhaustiveness guard for switches; `ACTION_VARIANT` is exhaustive by construction so no switch lives in this file. @internal */
export const assertExhaustive = (value: never): never => {
  throw new Error(
    `HistoryRowFeatures: unhandled ${JSON.stringify(value)} -- update ACTION_VARIANT`,
  );
};

/** Union of actions that turn into the `created` variant. */
export const CREATED_ACTIONS: ReadonlySet<ActivityKind> = new Set<ActivityKind>(
  ["note_created", "directory_created"],
);

/** Note-target action prefixes. */
export const NOTE_TARGET_ACTIONS: ReadonlySet<ActivityKind> =
  new Set<ActivityKind>([
    "note_viewed",
    "note_created",
    "note_edited",
    "note_deleted",
    "note_published",
    "note_shared",
    "note_unshared",
    "note_restored",
    "note_archived",
    "note_version_restored",
    "note_attachment_added",
  ]);

/** Directory-target action prefixes. */
export const DIRECTORY_TARGET_ACTIONS: ReadonlySet<ActivityKind> =
  new Set<ActivityKind>([
    "directory_created",
    "directory_viewed",
    "directory_edited",
    "directory_deleted",
  ]);

/** Role-target action prefixes. */
export const ROLE_TARGET_ACTIONS: ReadonlySet<ActivityKind> =
  new Set<ActivityKind>(["role_grant", "role_revoke", "role_change"]);

/** Resolves the row variant from the entry: `score` -> "trending", `action` -> the variant in `ACTION_VARIANT`, missing -> "unknown". */
export const getHistoryRowKind = (entry: HistoryRowEntry): HistoryRowKind => {
  if (entry.score !== undefined) {
    return "trending";
  }
  if (entry.action === undefined) {
    return "unknown";
  }
  return ACTION_VARIANT[entry.action];
};

/** Returns the display metadata for an entry's variant (icon + caption + palette key). */
export const getHistoryRowMeta = (
  entry: HistoryRowEntry,
): HistoryRowVariantMeta => VARIANT_META[getHistoryRowKind(entry)];

/** Returns the short label string for an entry's variant (e.g. "Viewed", "Shared"). */
export const getHistoryRowVariantLabel = (entry: HistoryRowEntry): string =>
  VARIANT_META[getHistoryRowKind(entry)].label;

/** `true` when the entry carries an aggregated `score`. */
export const hasScore = (entry: HistoryRowEntry): boolean =>
  entry.score !== undefined;

/** `true` when the variant would render with a `created` icon. */
export const isCreatedRow = (entry: HistoryRowEntry): boolean =>
  getHistoryRowKind(entry) === "created";

/** `true` when the variant would render with the generic `edited` icon (a true plain edit, not viewed / shared / etc.). */
export const isEditedRow = (entry: HistoryRowEntry): boolean =>
  getHistoryRowKind(entry) === "edited";

/** `true` when the variant would render as `trending` (flame icon + score chip). Equivalent to `hasScore`. */
export const isTrendingRow = (entry: HistoryRowEntry): boolean =>
  getHistoryRowKind(entry) === "trending";

/** Per-action predicates; thin wrappers over `ACTION_VARIANT` so the wire between action and rendered icon stays single-sourced. */
export const isViewedRow = (entry: HistoryRowEntry): boolean =>
  entry.action !== undefined && ACTION_VARIANT[entry.action] === "viewed";

export const isPublishedRow = (entry: HistoryRowEntry): boolean =>
  entry.action !== undefined && ACTION_VARIANT[entry.action] === "published";

export const isSharedRow = (entry: HistoryRowEntry): boolean =>
  entry.action !== undefined &&
  (ACTION_VARIANT[entry.action] === "shared" ||
    ACTION_VARIANT[entry.action] === "unshared");

export const isDeletedRow = (entry: HistoryRowEntry): boolean =>
  entry.action !== undefined &&
  (ACTION_VARIANT[entry.action] === "deleted" ||
    ACTION_VARIANT[entry.action] === "directory_deleted");

export const isArchivedRow = (entry: HistoryRowEntry): boolean =>
  entry.action !== undefined && ACTION_VARIANT[entry.action] === "archived";

export const isRestoredRow = (entry: HistoryRowEntry): boolean =>
  entry.action !== undefined &&
  (ACTION_VARIANT[entry.action] === "restored" ||
    ACTION_VARIANT[entry.action] === "version_restored");

/** `true` when the entry's action targets a note. */
export const isNoteEvent = (entry: HistoryRowEntry): boolean =>
  entry.action !== undefined && NOTE_TARGET_ACTIONS.has(entry.action);

/** `true` when the entry's action targets a directory. */
export const isDirectoryEvent = (entry: HistoryRowEntry): boolean =>
  entry.action !== undefined && DIRECTORY_TARGET_ACTIONS.has(entry.action);

/** `true` when the entry's action targets a role. */
export const isRoleEvent = (entry: HistoryRowEntry): boolean =>
  entry.action !== undefined && ROLE_TARGET_ACTIONS.has(entry.action);

/** Formats an ISO timestamp into a human-friendly string; returns the raw input on parse failure. */
export const formatHistoryRowTimestamp = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return formatDistanceToNow(date, { addSuffix: true });
};

/** Builds the label for a row entry; looks up the note title via the query cache, falls back to `note_id`. */
export const formatHistoryRowLabel = (entry: HistoryRowEntry): string => {
  const note = queryClient.getQueryData<Note>(["notes", entry.note_id]);
  return note?.title || entry.note_id;
};

/** Extracts `note_title` / `note_content` from `metadata_json` for note events; returns empty strings for non-notes / malformed / missing. */
export const extractNoteMetadata = (
  row: HistoryRowEntry,
): { title: string; description: string } => {
  if (row.action === undefined || !row.action.startsWith("note_")) {
    return { title: "", description: "" };
  }
  if (!row.metadata_json) {
    return { title: "", description: "" };
  }
  let parsed: { note_title?: string; note_content?: string };
  try {
    parsed = JSON.parse(row.metadata_json);
  } catch {
    return { title: "", description: "" };
  }
  const title = parsed.note_title ?? "";
  const content = parsed.note_content ?? "";
  const description = content
    ? (crumble(content, HISTORY_ROW_DESCRIPTION_CAP)[0] ?? "")
    : "";
  return { title, description };
};

/** Target entity for the Recent Activity panel; mirrors the historical `ActivityTarget` shape. */
export type HistoryTarget =
  | { type: "note"; id: string }
  | { type: "directory"; id: string }
  | { type: "root" };

/** Resolved activity state for the panel. */
export interface HistoryState {
  rows: HistoryRowEntry[];
  isLoading: boolean;
  hasError: boolean;
}

/** Maps the panel's `target` to a `HistoryFilter` and fetches the rows; `limit` controls page size (default 8), `days` is the time window (default 30). */
export function useHistoryRows(
  target: HistoryTarget,
  limit: number = 8,
  days: number = 30,
): HistoryState {
  // Stable filter object so react-query reuses the cache when target/limit/days don't change.
  const filter = useMemo<HistoryFilter>(() => {
    const base: HistoryFilter = {
      mode: "history",
      actions: [
        "directory_created",
        "directory_deleted",
        "directory_edited",
        "note_created",
        "note_edited",
        "note_deleted",
        "note_published",
        "note_shared",
        "note_unshared",
      ],
      limit,
      days,
    };
    if (target.type === "note") {
      return { ...base, note_id: target.id };
    }
    if (target.type === "directory") {
      return { ...base, directory_id: target.id };
    }
    return base;
  }, [target, limit, days]);

  const result = useActivityHistory(filter);

  // `ActivityReply` rows are a structural superset of `HistoryRowEntry`; lift `title` / `description` from `metadata_json` so the view doesn't parse JSON.
  const rows: HistoryRowEntry[] = (result.data ?? []).map((row) => {
    const { title, description } = extractNoteMetadata(row);
    return {
      ...row,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
    };
  });

  return {
    rows,
    isLoading: result.isLoading,
    hasError: result.isError,
  };
}
