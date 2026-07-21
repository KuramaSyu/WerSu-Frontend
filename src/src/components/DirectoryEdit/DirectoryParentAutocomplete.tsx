import { Autocomplete, TextField, createFilterOptions } from "@mui/material";
import type { SyntheticEvent } from "react";
import type { DirectoryReply } from "../../api/models/directory";
import {
  NO_PARENT_LABEL,
  ROOT_PARENT_LABEL,
  labelOf,
} from "../../pages/DirectoryEdit/directoryFormShared";

/**
 * Prefix attached to the "create / use" custom option in the
 * dropdown. The option text is `${USE_OPTION_PREFIX}'<user text>'`
 * (e.g. `Use 'A'`) and is detected by this prefix on selection so
 * the value we feed back to the parent selector is just the typed
 * text (no wrapper).
 */
const USE_OPTION_PREFIX = "Use '";
const USE_OPTION_SUFFIX = "'";

/**
 * Returns true when `value` is the auto-generated "Use '<text>'"
 * option for a free-text user entry. Used to distinguish that
 * synthetic option from a real directory whose label happens to
 * start with the same prefix (unlikely in practice, but defensive).
 */
const isUseOption = (value: string): boolean =>
  value.startsWith(USE_OPTION_PREFIX) && value.endsWith(USE_OPTION_SUFFIX);

const defaultFilter = createFilterOptions<string>();

/**
 * Wraps the default MUI `filterOptions` to always prepend a
 * "Use '<text>'" option when the user has typed something that
 * doesn't exactly match an existing option. The user can then
 * click that option (or press Enter) to confirm the typed text
 * as the value, which keeps the input showing exactly what was
 * typed.
 *
 * If the typed text exactly matches an existing option, the
 * synthetic "Use" option is omitted to avoid the duplicate.
 */
const filterOptions = (
  options: string[],
  state: { inputValue: string },
): string[] => {
  const filtered = defaultFilter(options, state);
  const typed = state.inputValue.trim();
  if (typed === "") {
    return filtered;
  }
  if (filtered.includes(typed)) {
    return filtered;
  }
  return [`${USE_OPTION_PREFIX}${typed}${USE_OPTION_SUFFIX}`, ...filtered];
};

export interface DirectoryParentAutocompleteProps {
  /** Sorted list of directories to surface as suggestions. */
  directories: DirectoryReply[];
  /**
   * The current input value (raw text). The component is fully
   * controlled: pass whatever the user has typed.
   */
  value: string;
  /**
   * Setter that receives the raw text the user wants as the
   * value. Called for both keystrokes and dropdown selections
   * (the "Use '<text>'" option's text is unwrapped before the
   * call so the input keeps showing what the user typed).
   */
  onChange: (value: string) => void;
  /** True when the current value resolves to a known directory. */
  isValid: boolean;
  /**
   * Helper text shown beneath the input. Pass an error message
   * when `isValid` is false; the input renders with an error
   * outline automatically.
   */
  helperText?: string;
  /** Placeholder text shown when the input is empty. */
  placeholder?: string;
}

/**
 * The writable parent directory picker used by both
 * `DirectoryEdit` and `DirectoryCreate`. The user can type any
 * text; the dropdown surfaces existing directories plus a
 * "Use '<text>'" option at the top for confirming a custom
 * value. Validation is the caller's responsibility (via the
 * `isValid` prop) — the picker just surfaces the error state.
 */
export const DirectoryParentAutocomplete: React.FC<
  DirectoryParentAutocompleteProps
> = ({ directories, value, onChange, isValid, helperText, placeholder }) => {
  const options = [
    ROOT_PARENT_LABEL,
    NO_PARENT_LABEL,
    ...directories.map(labelOf),
  ];

  return (
    <Autocomplete
      fullWidth
      freeSolo
      options={options}
      value={value}
      inputValue={value}
      // Wire both `onInputChange` (keystrokes) and `onChange`
      // (dropdown selections) to the same setter so the input
      // and the dropdown stay in sync. We unwrap the
      // synthetic "Use '<text>'" option to the raw typed text
      // before calling back, so the input keeps showing what
      // the user typed.
      onInputChange={(_event, value) => onChange(value)}
      onChange={(_event: SyntheticEvent, selected: string | null) => {
        if (selected === null) {
          // Dropdown closed without a selection; leave the
          // current value alone so the user can keep typing.
          return;
        }
        if (isUseOption(selected)) {
          // Strip the wrapper; the typed text is the value.
          const inner = selected.slice(
            USE_OPTION_PREFIX.length,
            selected.length - USE_OPTION_SUFFIX.length,
          );
          onChange(inner);
          return;
        }
        onChange(selected);
      }}
      filterOptions={filterOptions}
      renderOption={(props, option) => {
        const { key, ...rest } = props as typeof props & { key: string };
        if (isUseOption(option)) {
          return (
            <li key={key} {...rest}>
              <strong>{option}</strong>
            </li>
          );
        }
        return (
          <li key={key} {...rest}>
            {option}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Parent"
          placeholder={placeholder ?? "Type a directory name"}
          error={!isValid && value.length > 0}
          helperText={!isValid && value.length > 0 ? helperText : undefined}
        />
      )}
    />
  );
};
