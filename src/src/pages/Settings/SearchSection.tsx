import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { RestNotesSearchType } from "../../api/models/search";
import {
  SEARCH_TYPE_NO_OVERRIDE,
  useSearchSettings,
  type SearchTypeDefault,
} from "../../zustand/useSearchSettings";

const PICKABLE = [
  RestNotesSearchType.KEYWORD,
  RestNotesSearchType.TYPO_TOLERANT,
  RestNotesSearchType.CONTEXT,
] as const satisfies readonly RestNotesSearchType[];

// Label per mode; mirrors the labels used inside SearchStrategySelect.
const TYPE_LABEL: { [K in (typeof PICKABLE)[number]]: string } = {
  [RestNotesSearchType.KEYWORD]: "Keyword",
  [RestNotesSearchType.TYPO_TOLERANT]: "Fuzzy",
  [RestNotesSearchType.CONTEXT]: "Context",
};

// Settings Search category. Lets the user pick the search mode
// the global overlay opens with; in-overlay clicks still override.
export const SearchSection: React.FC = () => {
  const { defaultSearchType, setDefaultSearchType } = useSearchSettings();

  return (
    <Stack direction="column" spacing={3}>
      <Stack>
        <Typography variant="subtitle1">Default search mode</Typography>
        <Typography variant="body2" color="text.secondary">
          Which mode the global search overlay opens with. `Default` leaves
          the choice un-set, so the overlay falls back to the app-wide
          default. Switching modes inside the overlay still overrides this
          for the current session; the choice here only takes effect on the
          next fresh page load.
        </Typography>
      </Stack>

      <FormControl size="small" sx={{ maxWidth: 320 }}>
        <InputLabel id="default-search-type-label">Search mode</InputLabel>
        <Select<SearchTypeDefault>
          labelId="default-search-type-label"
          label="Search mode"
          value={defaultSearchType}
          onChange={(e) => setDefaultSearchType(e.target.value)}
        >
          <MenuItem value={SEARCH_TYPE_NO_OVERRIDE}>Default</MenuItem>
          {PICKABLE.map((t) => (
            <MenuItem key={t} value={t}>
              {TYPE_LABEL[t]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
};