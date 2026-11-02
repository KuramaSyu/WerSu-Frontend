import { useMemo, useState } from "react";
import { Divider, Pagination, Stack, Typography } from "@mui/material";
import { useQueries } from "@tanstack/react-query";
import { M2 } from "../../statics";
import { NoteList, NoteRowSkeleton } from "./RecentNotes";
import TranslucentPaper from "../../components/TranslucentPaper";
import { useFrequentlyUsedRows } from "../../components/FrequentlyUsed/FrequentlyUsedFeatures";
import { noteQueries } from "../../api/queries/useNoteQueries";
import type { HistoryRowEntry } from "../../components/RecentActivity/HistoryRowFeatures";
import type { MinimalNote, Note } from "../../api/models/search";
import type { MostUsedAlgorithm } from "../../api/models/history";

/** Rows rendered per page. */
const DEFAULT_PAGE_SIZE = 15;

/** Upper bound handed to the backend; rows are paged client-side. */
const DEFAULT_FETCH_LIMIT = 500;

export interface FrequentlyUsedNotesProps {
  /** Latest notes used to enrich rows with folders / tags / timestamps. */
  notes?: MinimalNote[];
  /** Max number of notes to fetch (paged client-side). */
  limit?: number;
  /** Scoring algorithm the backend aggregates with. */
  algorithm?: MostUsedAlgorithm;
  /** Only count activity within this many days. Omit for all time. */
  days?: number;
  /** Count at most one hit per note per day. */
  uniquePerDay?: boolean;
  /** Restrict to notes in any of these directories (backend-expanded). */
  directoryIds?: string[];
  /** Rows shown per page. */
  pageSize?: number;
  /** Skip the translucent surface (e.g. when already nested in one). */
  bare?: boolean;
  /** Called when a note's folder chip is clicked. */
  onDirectoryClick?: (directoryId: string) => void;
}

/**
 * Frequently-used notes rendered with the same single-line list style as
 * the "Recent notes" view. Rows borrow folder / tag / timestamp metadata
 * from the latest-notes lookup when present; otherwise the visible page's
 * notes are fetched individually so they still show folders and time.
 * All rows are paged client-side with a pager at the bottom.
 */
export const FrequentlyUsedNotes: React.FC<FrequentlyUsedNotesProps> = ({
  notes,
  limit = DEFAULT_FETCH_LIMIT,
  algorithm = "MOST_USED_ALGORITHM_LOG_COUNT",
  days,
  uniquePerDay,
  directoryIds,
  pageSize = DEFAULT_PAGE_SIZE,
  bare = false,
  onDirectoryClick,
}) => {
  const { rows, isLoading, hasError } = useFrequentlyUsedRows({
    limit,
    algorithm,
    days,
    uniquePerDay,
    directoryIds,
  });
  const [page, setPage] = useState(1);

  // Reset to the first page when the filter changes (documented
  // "adjust state during render" pattern, avoids an effect).
  const filterKey = `${algorithm}|${days ?? ""}|${uniquePerDay ?? ""}|${
    directoryIds?.join(",") ?? ""
  }`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  const notesById = useMemo(() => {
    const map: Record<string, MinimalNote> = {};
    for (const note of notes ?? []) {
      map[note.id] = note;
    }
    return map;
  }, [notes]);

  // Resolve only the visible page.
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  // Rows missing from the latest-notes lookup need their note fetched so
  // folder / tag / timestamp metadata is available.
  const missingIds = pageRows
    .filter((row) => !notesById[row.note_id])
    .map((row) => row.note_id);

  const detailQueries = useQueries({
    queries: missingIds.map((id) => noteQueries.detail(id)),
  });

  const detailById = new Map<string, Note | undefined>();
  const detailLoadingIds = new Set<string>();
  missingIds.forEach((id, index) => {
    const query = detailQueries[index];
    detailById.set(id, query?.data);
    if (query?.isLoading) {
      detailLoadingIds.add(id);
    }
  });

  const resolvedPage = pageRows.map((row: HistoryRowEntry): MinimalNote => {
    const known = notesById[row.note_id];
    if (known) {
      return known;
    }
    const detail = detailById.get(row.note_id);
    if (detail) {
      return detail;
    }
    // Fall back to the activity row while the detail fetch is in flight
    // or unavailable.
    return {
      id: row.note_id,
      title: row.title ?? "",
      author_id: "",
      updated_at: "",
      stripped_content: row.description ?? "",
      directory_ids: [],
      tag_ids: [],
    };
  });

  if (isLoading) {
    const skeleton = (
      <Stack divider={<Divider flexItem />}>
        {Array.from({ length: pageSize }).map((_, index) => (
          <NoteRowSkeleton key={`frequent-skeleton-${index}`} />
        ))}
      </Stack>
    );
    return bare ? (
      skeleton
    ) : (
      <TranslucentPaper elevation={1} sx={{ overflow: "hidden" }}>
        {skeleton}
      </TranslucentPaper>
    );
  }

  if (hasError) {
    return (
      <Typography variant="body2" color="error" sx={{ p: M2 }}>
        Failed to load frequently used notes.
      </Typography>
    );
  }

  return (
    <Stack spacing={M2}>
      <NoteList
        notes={resolvedPage}
        emptyText="No frequently used notes yet."
        bare={bare}
        skeletonIds={detailLoadingIds}
        onDirectoryClick={onDirectoryClick}
      />
      {pageCount > 1 && (
        <Pagination
          count={pageCount}
          page={safePage}
          onChange={(_event, value) => setPage(value)}
          size="small"
          sx={{ alignSelf: "center" }}
        />
      )}
    </Stack>
  );
};

export default FrequentlyUsedNotes;