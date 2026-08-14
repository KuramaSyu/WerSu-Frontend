import { Box, Stack, Typography, useTheme } from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  useFrequentlyUsedRows,
  useLastUsedRows,
} from "./FrequentlyUsedFeatures";
import type { HistoryRowEntry } from "../RecentActivity/HistoryRowFeatures";

import { FeatureFlagName, useFeatureStore } from "../../zustand/FeatureStore";
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
 * Props for the LastUsedPanel component.
 */
export interface LastUsedPanelProps {
  /** Optional title override. */
  title?: string | null;
  /** Max number of items to fetch and render. */
  limit?: number;
  /** Time window the backend uses to scope the activity log. */
  days?: number;
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
  limit = 20,
}) => {
  const { rows, isLoading, hasError } = useFrequentlyUsedRows(limit);

  // use theme also allows for a non global <ThemeProvider> theme to be picked
  // -> and PanelSection passes in a dimmed theme on not hover
  const theme = useTheme();
  const navigate = useNavigate();
  const developerMode = useFeatureStore(
    (state) => state.flags[FeatureFlagName.DeveloperMode],
  );

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
            developerMode={developerMode}
          />
        ))}
      </Stack>
    </Box>
  );
};

/**
 * Shows the most recently viewed notes (last-N `note_viewed` events).
 *
 * Defaults to the last 3 unique notes so the section stays compact
 * while still showing a useful recent-history snippet. Duplicates are
 * collapsed by `note_id` -- re-viewing the same note repeatedly should
 * not push other recently-viewed notes out of the list. The
 * Frequently Used panel covers the "what should I look at" use case.
 * Data fetching is owned by `useLastUsedRows`.
 */
export const LastUsedPanel: React.FC<LastUsedPanelProps> = ({
  title = "Last used",
  limit = 3,
  days = 30,
}) => {
  const { rows, isLoading, hasError } = useLastUsedRows(limit, days);

  // some here: we need to accept a theme from a parent PanelSection which is dimmed
  // and store only provides global theme
  const theme = useTheme();
  const navigate = useNavigate();
  const developerMode = useFeatureStore(
    (state) => state.flags[FeatureFlagName.DeveloperMode],
  );

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
          Loading last used notes...
        </Typography>
      )}
      {hasError && !isLoading && (
        <Typography variant="body2" color="error">
          Failed to load last used notes.
        </Typography>
      )}
      {!isLoading && !hasError && rows.length === 0 && (
        <Typography variant="body2" color="textSecondary">
          No recently viewed notes yet.
        </Typography>
      )}
      <Stack spacing={1}>
        {rows.map((entry) => (
          <HistoryRowView
            key={entry.id ?? entry.note_id}
            entry={entry}
            onClick={handleItemClick}
            headerMode="entityTitle"
            showDescription={false}
            developerMode={developerMode}
          />
        ))}
      </Stack>
    </Box>
  );
};
