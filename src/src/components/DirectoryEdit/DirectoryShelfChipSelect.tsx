import { Autocomplete, Stack, TextField } from "@mui/material";
import type { ShelfReply } from "../../api/models/shelf";
import { disambiguateLabels } from "../../utils/disambiguateLabels";

const labelOf = (shelf: ShelfReply): string =>
  shelf.display_name ?? shelf.slug ?? shelf.id;

export interface DirectoryShelfChipSelectProps {
  /** Shelves surfaced in the dropdown (full list, not just selected). */
  shelves: ShelfReply[];
  /** Currently selected shelf ids. */
  value: string[];
  /** Called with the next id list whenever chips are added/removed. */
  onChange: (ids: string[]) => void;
  helperText?: string;
  error?: boolean;
}

/**
 * Multi-select chip picker for directory shelf memberships.
 * Disambiguates duplicate names by suffixing the id only on collision.
 */
export const DirectoryShelfChipSelect: React.FC<
  DirectoryShelfChipSelectProps
> = ({ shelves, value, onChange, helperText, error }) => {
  const labels = disambiguateLabels(shelves, labelOf, (shelf) => shelf.id);
  const getOptionLabel = (shelf: ShelfReply): string =>
    labels.get(shelf) ?? labelOf(shelf);

  const selected = value
    .map((id) => shelves.find((shelf) => shelf.id === id))
    .filter((shelf): shelf is ShelfReply => shelf !== undefined);

  return (
    <Stack>
      <Autocomplete<ShelfReply, true, false, false>
        multiple
        options={shelves}
        value={selected}
        onChange={(_event, next) => onChange(next.map((shelf) => shelf.id))}
        getOptionLabel={getOptionLabel}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Shelves"
            placeholder="Pick shelves"
            error={error}
            helperText={helperText}
          />
        )}
      />
    </Stack>
  );
};
