import { Box, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useFrequentlyUsedRows } from "./FrequentlyUsedFeatures";
import type { HistoryRowEntry } from "../RecentActivity/HistoryRowFeatures";

import { useThemeStore } from "../../zustand/useThemeStore";
import { HistoryRowView } from "../RecentActivity/HistoryRowView";

/**
 * Props for the FrequentlyUsedPanel component.
 */
export interface FrequentlyUsedPanelProps {
  /** Optional title override. */
  title?: string | null;
  /** Max number of items to fetch and render. */
  limit?: number;
}

/**
 * Generic panel that shows frequently used notes.
 *
 * Reuses `HistoryRowView` for rendering: rows coming back from
 * `mode=most_used` carry a `score`, which the view turns into a
 * flame icon + chip automatically. Data fetching is owned by
 * `useFrequentlyUsedRows`.
 */
export const FrequentlyUsedPanel: React.FC<FrequentlyUsedPanelProps> = ({
  title = "Frequently used",
  limit = 8,
}) => {
  const { rows, isLoading, hasError } = useFrequentlyUsedRows(limit);
  const { theme } = useThemeStore();
  const navigate = useNavigate();

  // when clicking, reroute to /n/<note_id>
  const handleItemClick = (entry: HistoryRowEntry) => {
    navigate(`/n/${entry.note_id}`);
  };

  return (
    <Box sx={{ color: theme.palette.text.secondary }}>
      {title && (
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, mb: theme.spacing(1) }}
        >
          {title}
        </Typography>
      )}
      {isLoading && (
        <Typography variant="body2" color="textSecondary">
          Loading frequently used notes...
        </Typography>
      )}
      {hasError && !isLoading && (
        <Typography variant="body2" color="error">
          Failed to load frequently used notes.
        </Typography>
      )}
      {!isLoading && !hasError && rows.length === 0 && (
        <Typography variant="body2" color="textSecondary">
          No frequently used notes yet.
        </Typography>
      )}
      <Stack spacing={1}>
        {rows.map((entry) => (
          <HistoryRowView
            key={entry.note_id}
            entry={entry}
            onClick={handleItemClick}
            headerMode="entityTitle"
          />
        ))}
      </Stack>
    </Box>
  );
};
