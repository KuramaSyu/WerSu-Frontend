import { Autocomplete, Stack, TextField } from "@mui/material";
import type { DirectoryReply } from "../../api/models/directory";
import {
  ROOT_PARENT_ID,
  ROOT_PARENT_LABEL,
  labelOf,
} from "../../pages/DirectoryEdit/directoryFormShared";
import { disambiguateLabels } from "../../utils/disambiguateLabels";

/** Sentinel option for "(no parent / top level)" so users can clear the pick. */
export interface TopLevelOption {
  id: typeof ROOT_PARENT_ID;
  label: string;
}

export const TOP_LEVEL_OPTION: TopLevelOption = {
  id: ROOT_PARENT_ID,
  label: ROOT_PARENT_LABEL,
};

/** Union of every selectable option in the parent picker. */
export type ParentOption = DirectoryReply | TopLevelOption;


const isTopLevel = (option: ParentOption): option is TopLevelOption =>
  option.id === TOP_LEVEL_OPTION.id;

const baseLabel = (option: ParentOption): string =>
  isTopLevel(option) ? option.label : labelOf(option);

/** Parent shelf id (or own id) used for the first-pass disambiguation. */
const firstId = (option: ParentOption): string =>
  isTopLevel(option)
    ? ROOT_PARENT_ID
    : ((option as DirectoryReply).shelf_ids?.[0] ?? option.id);

/** Own id used when the first-pass label is still ambiguous. */
const secondId = (option: ParentOption): string => option.id;

const isOptionEqualToValue = (
  option: ParentOption,
  value: ParentOption,
): boolean => option.id === value.id;

export interface DirectoryParentChipSelectProps {
  /** All directories the user can parent under. */
  directories: DirectoryReply[];
  /** Currently selected option ids (top-level + real directory ids). */
  value: string[];
  /**
   * Called with the next id list whenever the user adds or removes a
   * chip. Empty array means no parent selected (treated as top-level
   * by the hook layer).
   */
  onChange: (ids: string[]) => void;
  /** True when every selected id resolves to a known directory. */
  isValid: boolean;
  helperText?: string;
}

/**
 * Multi-select chip picker for directory parents. Includes a
 * Root sentinel so the user can clear selection; duplicates
 * disambiguate as "label", "label (shelf)", "label (shelf) (id)".
 */
export const DirectoryParentChipSelect: React.FC<
  DirectoryParentChipSelectProps
> = ({ directories, value, onChange, isValid, helperText }) => {
  const options: ParentOption[] = [TOP_LEVEL_OPTION, ...directories];

  const labels = disambiguateLabels(options, baseLabel, firstId, secondId);
  const getOptionLabel = (option: ParentOption): string =>
    labels.get(option) ?? baseLabel(option);

  const selected = value
    .map((id) => options.find((opt) => opt.id === id))
    .filter((option): option is ParentOption => option !== undefined);

  return (
    <Stack>
      <Autocomplete<ParentOption, true, false, false>
        multiple
        options={options}
        value={selected}
        onChange={(_event, next) => {
          // Root + anything collapses to just the anything.
          const realIds = next
            .filter((option) => !isTopLevel(option))
            .map((option) => option.id);
          if (realIds.length > 0) {
            onChange(realIds);
            return;
          }
          onChange(next.map((option) => option.id));
        }}
        getOptionLabel={getOptionLabel}
        isOptionEqualToValue={isOptionEqualToValue}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Parent directories"
            placeholder="Type to filter"
            error={!isValid}
            helperText={
              !isValid
                ? (helperText ??
                  "Pick one or more parents. Clear all chips for top level.")
                : helperText
            }
          />
        )}
      />
    </Stack>
  );
};