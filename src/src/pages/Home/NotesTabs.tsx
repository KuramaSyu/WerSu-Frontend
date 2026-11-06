import { useMemo, useState, type ReactElement } from "react";
import {
  Autocomplete,
  Badge,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import NotesIcon from "@mui/icons-material/Notes";
import DraftsIcon from "@mui/icons-material/Drafts";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import FilterListIcon from "@mui/icons-material/FilterList";
import { M1 } from "../../statics";
import { ColoredToggleButton } from "../../components/ColoredToggleButton";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { DraftNotes } from "./DraftNotes";
import { RecentNotes } from "./RecentNotes";
import { FrequentlyUsedNotes } from "./FrequentlyUsedNotes";
import { useAllDirectoriesQuery } from "../../api/queries/directoryQueries";
import { expandToSubtree } from "../../zustand/useSearchFilterStore";
import { directoryLabel } from "../../components/search/results/directoryPath";
import type { DirectoryReply } from "../../api/models/directory";
import type { MinimalNote } from "../../api/models/search";
import type { MostUsedAlgorithm } from "../../api/models/history";

const RECENT_TAB = 0;
const DRAFTS_TAB = 1;
const FREQUENT_TAB = 2;

/** The three note lists, shared by the desktop tabs and the mobile dropdown. */
const TAB_OPTIONS: { value: number; label: string; icon: ReactElement }[] = [
  {
    value: RECENT_TAB,
    label: "Recent notes",
    icon: <NotesIcon fontSize="small" />,
  },
  { value: DRAFTS_TAB, label: "Drafts", icon: <DraftsIcon fontSize="small" /> },
  {
    value: FREQUENT_TAB,
    label: "Frequently used",
    icon: <LocalFireDepartmentIcon fontSize="small" />,
  },
];

/** Filter categories offered in the "Filter by:" row. */
type FilterCategory = "directory" | "window" | "type";

/** Default scoring algorithm. */
const DEFAULT_ALGORITHM: MostUsedAlgorithm = "MOST_USED_ALGORITHM_LOG_COUNT";

/** Scoring options for the "Frequently used" tab. */
const ALGORITHM_OPTIONS: { value: MostUsedAlgorithm; label: string }[] = [
  { value: "MOST_USED_ALGORITHM_COUNT", label: "Count" },
  { value: "MOST_USED_ALGORITHM_LOG_COUNT", label: "Log count" },
];

interface DayOption {
  /** Stable key used for selection state. */
  key: string;
  /** Human label rendered in the chip. */
  label: string;
  /** Resolved number of days handed to the backend. */
  days: number;
}

/** Friendly time-window chips. Note "7 days" and "1 week" are the same. */
const DAY_OPTIONS: DayOption[] = [
  { key: "1", label: "Today", days: 1 },
  { key: "3", label: "3 days", days: 3 },
  { key: "7", label: "7 days", days: 7 },
  { key: "14", label: "2 weeks", days: 14 },
  { key: "30", label: "1 month", days: 30 },
  { key: "90", label: "3 months", days: 90 },
  { key: "360", label: "1 year", days: 360 },
];

/** Selection keys for the special time windows. */
const CUSTOM_DAY_KEY = "custom";
const ALL_TIME_KEY = "all";

/** Day window selected by default (1 month). */
const DEFAULT_DAY_KEY = "30";

/** Short windows count every view instead of collapsing to one per day. */
const NON_UNIQUE_DAYS = new Set<number>([3, 7]);

/** Rounded pill buttons without an outline. */
const PILL_GROUP_SX = {
  gap: 1,
  "& .MuiToggleButtonGroup-grouped": {
    border: 0,
    borderRadius: 999,
    px: 2,
    "&:not(:first-of-type)": { marginLeft: 0 },
  },
} as const;

/** Compact sizing for the filter pills. */
const FILTER_BUTTON_SX = { py: 0.25, px: 1.25, minHeight: 0 } as const;

export interface NotesTabsProps {
  /** Notes for the "Recent notes" tab, newest first. */
  notes?: MinimalNote[];
  /** Tab to select on first render. Defaults to "Recent notes". */
  initialTab?: number;
  /** Most recent view/edit time per note id (ms since epoch). */
  lastActivityById?: ReadonlyMap<string, number>;
}

/**
 * Tabbed overview of the viewer's notes: recent notes, drafts, and
 * frequently used. Each tab has an icon. A "Filter by:" row next to the
 * tabs offers category pills (directory, time window, type) on every tab;
 * picking one opens its options just below. Active filters show as
 * removable chips, and clicking a folder chip on any note applies that
 * directory filter.
 */
export const NotesTabs: React.FC<NotesTabsProps> = ({
  notes,
  initialTab = RECENT_TAB,
  lastActivityById,
}) => {
  const { isMobile } = useBreakpoint();
  const theme = useTheme();
  const primaryAccent = theme.palette.primary.main;
  const [tab, setTab] = useState(initialTab);
  const [activeFilter, setActiveFilter] = useState<FilterCategory | null>(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [algorithm, setAlgorithm] =
    useState<MostUsedAlgorithm>(DEFAULT_ALGORITHM);
  const [dayKey, setDayKey] = useState<string>(DEFAULT_DAY_KEY);
  const [customDays, setCustomDays] = useState<number>(30);
  const [selectedDirectoryIds, setSelectedDirectoryIds] = useState<string[]>(
    [],
  );

  const { list: directories, byId: directoriesById } = useAllDirectoriesQuery();

  // Directory filter expands to the subtree for the note-list tabs; the
  // frequently-used backend expands each directory_id itself.
  const filterDirectoryIds = useMemo(() => {
    if (selectedDirectoryIds.length === 0) {
      return undefined;
    }
    const expanded = new Set<string>();
    for (const id of selectedDirectoryIds) {
      for (const child of expandToSubtree([id], "subtree", directoriesById)) {
        expanded.add(child);
      }
    }
    return [...expanded];
  }, [selectedDirectoryIds, directoriesById]);

  const selectedDirectories = useMemo(
    () =>
      selectedDirectoryIds
        .map((id) => directoriesById[id])
        .filter((directory): directory is DirectoryReply => Boolean(directory)),
    [selectedDirectoryIds, directoriesById],
  );

  const days =
    dayKey === ALL_TIME_KEY
      ? undefined
      : dayKey === CUSTOM_DAY_KEY
        ? customDays
        : (DAY_OPTIONS.find((option) => option.key === dayKey)?.days ?? 30);
  const uniquePerDay =
    days === undefined ? undefined : !NON_UNIQUE_DAYS.has(days);

  const dayLabel =
    dayKey === ALL_TIME_KEY
      ? "All time"
      : dayKey === CUSTOM_DAY_KEY
        ? `${customDays} days`
        : (DAY_OPTIONS.find((option) => option.key === dayKey)?.label ??
          `${days} days`);
  const algorithmLabel =
    ALGORITHM_OPTIONS.find((option) => option.value === algorithm)?.label ?? "";

  const hasActiveFilters =
    selectedDirectoryIds.length > 0 ||
    dayKey !== ALL_TIME_KEY ||
    algorithm !== DEFAULT_ALGORITHM;

  const activeFilterCount =
    (selectedDirectoryIds.length > 0 ? 1 : 0) +
    (dayKey !== ALL_TIME_KEY ? 1 : 0) +
    (algorithm !== DEFAULT_ALGORITHM ? 1 : 0);

  const handleDirectoryClick = (directoryId: string) => {
    // Apply the filter silently; don't pop open the directory filter box.
    setSelectedDirectoryIds((prev) =>
      prev.includes(directoryId) ? prev : [...prev, directoryId],
    );
  };

  const handleCustomDays = (raw: string) => {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      setCustomDays(Math.floor(parsed));
    }
  };

  const openFilterModal = () => {
    // Open on a concrete category so the modal always shows options.
    setActiveFilter((current) => current ?? "directory");
    setFilterModalOpen(true);
  };

  const clearFilters = () => {
    setSelectedDirectoryIds([]);
    setDayKey(ALL_TIME_KEY);
    setAlgorithm(DEFAULT_ALGORITHM);
  };

  // Shared filter panels: rendered inline on desktop and inside the modal
  // on mobile.
  const renderFilterOptions = () => (
    <Box
      sx={{
        pt: M1,
        display: "flex",
        justifyContent: "center",
      }}
    >
      {activeFilter === "directory" && (
        <Stack spacing={1} sx={{ alignItems: "center", width: "100%" }}>
          <Typography variant="caption" color="textSecondary">
            Only notes in these directories and their subdirectories
          </Typography>
          <Autocomplete<DirectoryReply, true>
            multiple
            size="small"
            options={directories ?? []}
            getOptionLabel={(option) =>
              directoryLabel(option.id, directoriesById)
            }
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={selectedDirectories}
            onChange={(_event, value) =>
              setSelectedDirectoryIds(value.map((option) => option.id))
            }
            renderInput={(params) => (
              <TextField {...params} label="Books & Chapters" />
            )}
            sx={{ width: "100%", maxWidth: 360 }}
          />
        </Stack>
      )}

      {activeFilter === "window" && (
        <Stack spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="caption" color="textSecondary">
            Only count activity within
          </Typography>
          <Stack
            direction="row"
            sx={{ flexWrap: "wrap", gap: 1, justifyContent: "center" }}
          >
            <Chip
              label="All time"
              clickable
              size="small"
              color={dayKey === ALL_TIME_KEY ? "primary" : "default"}
              variant={dayKey === ALL_TIME_KEY ? "filled" : "outlined"}
              onClick={() => setDayKey(ALL_TIME_KEY)}
            />
            {DAY_OPTIONS.map((option) => {
              const selected = dayKey === option.key;
              return (
                <Chip
                  key={option.key}
                  label={option.label}
                  clickable
                  size="small"
                  color={selected ? "primary" : "default"}
                  variant={selected ? "filled" : "outlined"}
                  onClick={() => setDayKey(option.key)}
                />
              );
            })}
            <Chip
              label="Custom"
              clickable
              size="small"
              color={dayKey === CUSTOM_DAY_KEY ? "primary" : "default"}
              variant={dayKey === CUSTOM_DAY_KEY ? "filled" : "outlined"}
              onClick={() => setDayKey(CUSTOM_DAY_KEY)}
            />
          </Stack>
          {dayKey === CUSTOM_DAY_KEY && (
            <TextField
              type="number"
              size="small"
              label="Days"
              value={customDays}
              onChange={(event) => handleCustomDays(event.target.value)}
              slotProps={{ htmlInput: { min: 1 } }}
              sx={{ width: 120 }}
            />
          )}
        </Stack>
      )}

      {activeFilter === "type" && (
        <Stack spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="caption" color="textSecondary">
            How repeated views are scored
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={algorithm}
            onChange={(_event, value: MostUsedAlgorithm | null) => {
              if (value) setAlgorithm(value);
            }}
            sx={PILL_GROUP_SX}
          >
            {ALGORITHM_OPTIONS.map((option) => (
              <ToggleButton key={option.value} value={option.value}>
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      )}
    </Box>
  );

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          // Tabs scroll horizontally on phones; the filter icon sits on the
          // same row, pinned to the right.
          alignItems: "center",
          minWidth: 0,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        {isMobile ? (
          <TextField
            select
            size="small"
            value={tab}
            onChange={(event) => setTab(Number(event.target.value))}
            aria-label="Note list"
            sx={{
              flex: "0 0 auto",
              width: "fit-content",
              my: 0.5,
              "& .MuiOutlinedInput-notchedOutline": { border: "none" },
            }}
          >
            {TAB_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  {option.icon}
                  <span>{option.label}</span>
                </Stack>
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <Tabs
            value={tab}
            onChange={(_event, value: number) => setTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ flex: 1, minWidth: 0 }}
          >
            {TAB_OPTIONS.map((option) => (
              <Tab
                key={option.value}
                icon={option.icon}
                iconPosition="start"
                label={option.label}
              />
            ))}
          </Tabs>
        )}

        {isMobile ? (
          <Stack
            direction="row"
            sx={{
              pr: 1,
              ml: "auto",
              justifyContent: "flex-end",
              flexShrink: 0,
            }}
          >
            <Tooltip title="Filter">
              <IconButton aria-label="Filter notes" onClick={openFilterModal}>
                <Badge badgeContent={activeFilterCount} color="primary">
                  <FilterListIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          </Stack>
        ) : (
          <Stack
            direction="row"
            spacing={1}
            sx={{
              pr: 1,
              pb: { xs: 1, md: 0 },
              alignItems: "center",
              flexWrap: "wrap",
              rowGap: 1,
              flexShrink: 0,
              justifyContent: { xs: "flex-start", md: "flex-end" },
            }}
          >
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{ whiteSpace: "nowrap" }}
            >
              Filter by:
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              <ColoredToggleButton
                size="small"
                accentColor={primaryAccent}
                value="directory"
                selected={activeFilter === "directory"}
                sx={FILTER_BUTTON_SX}
                onChange={() =>
                  setActiveFilter((current) =>
                    current === "directory" ? null : "directory",
                  )
                }
              >
                Book/Chapter
              </ColoredToggleButton>
              <ColoredToggleButton
                size="small"
                accentColor={primaryAccent}
                value="window"
                selected={activeFilter === "window"}
                sx={FILTER_BUTTON_SX}
                onChange={() =>
                  setActiveFilter((current) =>
                    current === "window" ? null : "window",
                  )
                }
              >
                Time window
              </ColoredToggleButton>
              <ColoredToggleButton
                size="small"
                accentColor={primaryAccent}
                value="type"
                selected={activeFilter === "type"}
                sx={FILTER_BUTTON_SX}
                onChange={() =>
                  setActiveFilter((current) =>
                    current === "type" ? null : "type",
                  )
                }
              >
                Type
              </ColoredToggleButton>
            </Stack>
          </Stack>
        )}
      </Box>

      {hasActiveFilters && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ mt: M1, flexWrap: "wrap", rowGap: 1 }}
        >
          {selectedDirectoryIds.map((id) => (
            <Chip
              key={id}
              size="small"
              color="primary"
              variant="outlined"
              label={`Book/Chapter: ${directoryLabel(id, directoriesById)}`}
              onDelete={() =>
                setSelectedDirectoryIds((prev) =>
                  prev.filter((directoryId) => directoryId !== id),
                )
              }
            />
          ))}
          {dayKey !== ALL_TIME_KEY && (
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={`Time window: ${dayLabel}`}
              onDelete={() => setDayKey(ALL_TIME_KEY)}
            />
          )}
          {algorithm !== DEFAULT_ALGORITHM && (
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={`Type: ${algorithmLabel}`}
              onDelete={() => setAlgorithm(DEFAULT_ALGORITHM)}
            />
          )}
        </Stack>
      )}

      {!isMobile && (
        <Collapse in={activeFilter !== null} unmountOnExit>
          {renderFilterOptions()}
        </Collapse>
      )}

      <Dialog
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Filter notes</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              <ColoredToggleButton
                size="small"
                accentColor={primaryAccent}
                value="directory"
                selected={activeFilter === "directory"}
                sx={FILTER_BUTTON_SX}
                onChange={() => setActiveFilter("directory")}
              >
                Book/Chapter
              </ColoredToggleButton>
              <ColoredToggleButton
                size="small"
                accentColor={primaryAccent}
                value="window"
                selected={activeFilter === "window"}
                sx={FILTER_BUTTON_SX}
                onChange={() => setActiveFilter("window")}
              >
                Time window
              </ColoredToggleButton>
              <ColoredToggleButton
                size="small"
                accentColor={primaryAccent}
                value="type"
                selected={activeFilter === "type"}
                sx={FILTER_BUTTON_SX}
                onChange={() => setActiveFilter("type")}
              >
                Type
              </ColoredToggleButton>
            </Stack>
            {renderFilterOptions()}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={clearFilters} disabled={!hasActiveFilters}>
            Clear all
          </Button>
          <Button onClick={() => setFilterModalOpen(false)} variant="contained">
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ mt: 2 }}>
        {tab === RECENT_TAB && (
          <RecentNotes
            notes={notes}
            filterDirectoryIds={filterDirectoryIds}
            maxAgeDays={days}
            lastActivityById={lastActivityById}
            onDirectoryClick={handleDirectoryClick}
          />
        )}
        {tab === DRAFTS_TAB && (
          <DraftNotes
            showTitle={false}
            emptyText="No unsaved drafts."
            filterDirectoryIds={filterDirectoryIds}
            maxAgeDays={days}
            onDirectoryClick={handleDirectoryClick}
          />
        )}
        {tab === FREQUENT_TAB && (
          <FrequentlyUsedNotes
            notes={notes}
            algorithm={algorithm}
            days={days}
            uniquePerDay={uniquePerDay}
            directoryIds={selectedDirectoryIds}
            onDirectoryClick={handleDirectoryClick}
          />
        )}
      </Box>
    </Box>
  );
};

export default NotesTabs;
