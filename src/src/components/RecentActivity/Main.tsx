import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useHistoryRows,
  type HistoryRowEntry,
  type HistoryTarget,
  getHistoryRowMeta,
  getHistoryRowVariantLabel,
  formatHistoryRowTimestamp,
} from "./HistoryRowFeatures";
import { FeatureFlagName, useFeatureStore } from "../../zustand/FeatureStore";
import {
  HistoryListPanel,
  IconTitleSubtitleRow,
} from "../Panels/HistoryListPanel";
import { CopyNameMenu } from "../RightClick/CopyNameMenu";
import { NoteVisibilityScope } from "../../api/models/noteVisibility";
import {
  isNoteHiddenForScope,
  useNoteVisibilityStore,
} from "../../zustand/useNoteVisibilityStore";

/**
 * Props for the RecentActivityPanel component.
 */
export interface RecentActivityPanelProps {
  /** Target entity to fetch activity for. */
  target: HistoryTarget;
  /** Optional title override. Pass null to suppress the inner heading. */
  title?: string | null;
  /** Max number of items to fetch and render. */
  limit?: number;
  /** Time window (days parameter on /api/history). Mirrors the previous maxDepth knob at the panel level. */
  days?: number;
}

/** Generic panel that shows recent activity for a note/directory.
 *  Data via useHistoryRows; row icons from VARIANT_META so every action keeps its colour and glyph. */
export const RecentActivityPanel: React.FC<RecentActivityPanelProps> = ({
  target,
  title = "Recent activity",
  limit = 8,
  days = 30,
}) => {
  const { rows, isLoading, hasError } = useHistoryRows(target, limit, days);
  const navigate = useNavigate();
  const developerMode = useFeatureStore(
    (state) => state.flags[FeatureFlagName.DeveloperMode],
  );
  const visibilityNotes = useNoteVisibilityStore((state) => state.notes);
  const visibilityDirectories = useNoteVisibilityStore(
    (state) => state.directories,
  );

  // Drop score-bearing rows (those belong to the Frequently Used panel).
  const recentRows = useMemo<HistoryRowEntry[]>(
    () =>
      rows.filter(
        (r) =>
          r.score === undefined &&
          !isNoteHiddenForScope(
            visibilityNotes,
            visibilityDirectories,
            r.note_id,
            NoteVisibilityScope.RECENT_NOTES,
            r.directory_id ? [r.directory_id] : [],
          ),
      ),
    [rows, visibilityNotes, visibilityDirectories],
  );

  return (
    <HistoryListPanel
      title={title}
      rows={recentRows}
      isLoading={isLoading}
      hasError={hasError}
      loadingText="Loading activity..."
      errorText="Failed to load activity."
      emptyText="No recent activity."
      renderRow={(entry) => {
        const e = entry as HistoryRowEntry;
        const meta = getHistoryRowMeta(e);
        const Icon = meta.icon;
        const isDirectoryEvent = Boolean(e.action?.startsWith("directory_"));
        const visibilityTarget = isDirectoryEvent
          ? e.directory_id
            ? { kind: "directory" as const, id: e.directory_id }
            : undefined
          : e.note_id
            ? { kind: "note" as const, id: e.note_id }
            : undefined;
        return (
          <CopyNameMenu
            text={e.title ?? ""}
            targetId={e.note_id}
            note={
              e.note_id && !isDirectoryEvent
                ? { id: e.note_id, title: e.title ?? "" }
                : undefined
            }
            visibilityScope={NoteVisibilityScope.RECENT_NOTES}
            visibilityTarget={visibilityTarget}
          >
            <IconTitleSubtitleRow
              icon={<Icon fontSize="small" color={meta.color} />}
              title={getHistoryRowVariantLabel(e)}
              subtitle={e.at ? formatHistoryRowTimestamp(e.at) : undefined}
              onClick={() => navigate(`/n/${e.note_id}`)}
              iconTooltip={meta.label}
              developerDebug={developerMode ? JSON.stringify(e) : undefined}
            />
          </CopyNameMenu>
        );
      }}
    />
  );
};
