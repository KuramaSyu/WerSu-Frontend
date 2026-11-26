import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
} from "@mui/material";
import type { MostUsedAlgorithm } from "../../api/models/history";
import {
  FREQUENTLY_USED_ALGORITHMS,
  FREQUENTLY_USED_ALGORITHM_DESCRIPTION,
  FREQUENTLY_USED_ALGORITHM_LABEL,
  FREQUENTLY_USED_COUNTING_OPTIONS,
  MAX_RAIL_LIMIT,
  MIN_RAIL_LIMIT,
  RAIL_WINDOW_OPTIONS,
  usePersonalizationSettings,
  type FrequentlyUsedCounting,
} from "../../zustand/usePersonalizationSettings";
import { SettingsGroup, SettingsRow } from "./SettingsRow";

/** Maps a stored day count back to the matching select key. */
const windowKeyForDays = (days: number | null): string =>
  RAIL_WINDOW_OPTIONS.find((option) => option.days === days)?.key ??
  (days === null ? "all" : `${days}`);

const daysForWindowKey = (key: string): number | null =>
  RAIL_WINDOW_OPTIONS.find((option) => option.key === key)?.days ?? null;

const RAIL_LIMIT_MARKS = [
  { value: MIN_RAIL_LIMIT, label: `${MIN_RAIL_LIMIT}` },
  { value: MAX_RAIL_LIMIT, label: `${MAX_RAIL_LIMIT}` },
];

/**
 * Settings > Personalize.
 *
 * Controls how the Home page's left rail builds its history blocks. The
 * frequently-used block is the main subject: the user picks the time
 * window, the ranking algorithm, whether the backend may count a note at
 * most once per day, and how many rows the rail renders. The last-used
 * block gets a matching time window and row count.
 */
export const PersonalizeSection: React.FC = () => {
  const frequentlyUsedDays = usePersonalizationSettings(
    (state) => state.frequentlyUsedDays,
  );
  const frequentlyUsedAlgorithm = usePersonalizationSettings(
    (state) => state.frequentlyUsedAlgorithm,
  );
  const frequentlyUsedCounting = usePersonalizationSettings(
    (state) => state.frequentlyUsedCounting,
  );
  const frequentlyUsedRailLimit = usePersonalizationSettings(
    (state) => state.frequentlyUsedRailLimit,
  );
  const lastUsedDays = usePersonalizationSettings(
    (state) => state.lastUsedDays,
  );
  const lastUsedRailLimit = usePersonalizationSettings(
    (state) => state.lastUsedRailLimit,
  );

  const setFrequentlyUsedDays = usePersonalizationSettings(
    (state) => state.setFrequentlyUsedDays,
  );
  const setFrequentlyUsedAlgorithm = usePersonalizationSettings(
    (state) => state.setFrequentlyUsedAlgorithm,
  );
  const setFrequentlyUsedCounting = usePersonalizationSettings(
    (state) => state.setFrequentlyUsedCounting,
  );
  const setFrequentlyUsedRailLimit = usePersonalizationSettings(
    (state) => state.setFrequentlyUsedRailLimit,
  );
  const setLastUsedDays = usePersonalizationSettings(
    (state) => state.setLastUsedDays,
  );
  const setLastUsedRailLimit = usePersonalizationSettings(
    (state) => state.setLastUsedRailLimit,
  );

  return (
    <Stack spacing={2}>
      <SettingsGroup
        title="Frequently used (Home left rail)"
        description="How the frequently-used block decides which notes you keep coming back to."
      >
        <SettingsRow
          title="Time window"
          description="Only activity inside this window counts toward the ranking. “All time” lets the backend look at the full history."
          control={
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="frequently-used-window-label">
                Time window
              </InputLabel>
              <Select
                labelId="frequently-used-window-label"
                label="Time window"
                value={windowKeyForDays(frequentlyUsedDays)}
                onChange={(event) =>
                  setFrequentlyUsedDays(daysForWindowKey(event.target.value))
                }
              >
                {RAIL_WINDOW_OPTIONS.map((option) => (
                  <MenuItem key={option.key} value={option.key}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          }
        />

        <SettingsRow
          title="Ranking algorithm"
          description={
            FREQUENTLY_USED_ALGORITHM_DESCRIPTION[frequentlyUsedAlgorithm]
          }
          control={
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="frequently-used-algorithm-label">
                Algorithm
              </InputLabel>
              <Select<MostUsedAlgorithm>
                labelId="frequently-used-algorithm-label"
                label="Algorithm"
                value={frequentlyUsedAlgorithm}
                onChange={(event) =>
                  setFrequentlyUsedAlgorithm(event.target.value)
                }
              >
                {FREQUENTLY_USED_ALGORITHMS.map((algorithm) => (
                  <MenuItem key={algorithm} value={algorithm}>
                    {FREQUENTLY_USED_ALGORITHM_LABEL[algorithm]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          }
        />

        <SettingsRow
          title="Counting repeat opens"
          description={
            FREQUENTLY_USED_COUNTING_OPTIONS.find(
              (option) => option.value === frequentlyUsedCounting,
            )?.description
          }
          control={
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="frequently-used-counting-label">
                Counting
              </InputLabel>
              <Select<FrequentlyUsedCounting>
                labelId="frequently-used-counting-label"
                label="Counting"
                value={frequentlyUsedCounting}
                onChange={(event) =>
                  setFrequentlyUsedCounting(event.target.value)
                }
              >
                {FREQUENTLY_USED_COUNTING_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          }
        />

        <SettingsRow
          title="Entries in the rail"
          description="How many frequently-used notes the Home left rail shows."
        >
          <Stack spacing={0.5} sx={{ pt: 0.5, maxWidth: 360 }}>
            <Slider
              value={frequentlyUsedRailLimit}
              min={MIN_RAIL_LIMIT}
              max={MAX_RAIL_LIMIT}
              step={1}
              marks={RAIL_LIMIT_MARKS}
              valueLabelDisplay="auto"
              onChange={(_event, value) =>
                setFrequentlyUsedRailLimit(value as number)
              }
              aria-label="Frequently used entries in the rail"
            />
          </Stack>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup
        title="Last used (Home left rail)"
        description="The last-used block lists notes you opened or edited most recently."
      >
        <SettingsRow
          title="Time window"
          description="How far back the block looks for recent views and edits."
          control={
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="last-used-window-label">Time window</InputLabel>
              <Select
                labelId="last-used-window-label"
                label="Time window"
                value={windowKeyForDays(lastUsedDays)}
                onChange={(event) =>
                  setLastUsedDays(daysForWindowKey(event.target.value) ?? 30)
                }
              >
                {RAIL_WINDOW_OPTIONS.filter(
                  (option) => option.days !== null,
                ).map((option) => (
                  <MenuItem key={option.key} value={option.key}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          }
        />

        <SettingsRow
          title="Entries in the rail"
          description="How many recently used notes the Home left rail shows."
        >
          <Stack spacing={0.5} sx={{ pt: 0.5, maxWidth: 360 }}>
            <Slider
              value={lastUsedRailLimit}
              min={MIN_RAIL_LIMIT}
              max={MAX_RAIL_LIMIT}
              step={1}
              marks={RAIL_LIMIT_MARKS}
              valueLabelDisplay="auto"
              onChange={(_event, value) =>
                setLastUsedRailLimit(value as number)
              }
              aria-label="Last used entries in the rail"
            />
          </Stack>
        </SettingsRow>
      </SettingsGroup>
    </Stack>
  );
};

export default PersonalizeSection;
