import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from "@mui/material";

export const ROOT_PARENT_ID = "root";

export const ROOT_PARENT_LABEL = "Root (no parent)";

interface DirectorySelectOption {
  id: string;
  label: string;
}

interface DirectorySelectProps {
  value: string;
  onChange: (value: string) => void;
  options: DirectorySelectOption[];
  label?: string;
  id?: string;
  labelId?: string;
  includeRoot?: boolean;
  rootLabel?: string;
}

/**
 * Reusable directory picker. Renders a MUI Select with a Root sentinel
 * option (representing "no parent") followed by the provided options.
 *
 * `Root` is encoded with the sentinel value from `ROOT_PARENT_ID` and a
 * dedicated label that callers can override.
 */
export const DirectorySelect: React.FC<DirectorySelectProps> = ({
  value,
  onChange,
  options,
  label = "Parent",
  id = "directory-select",
  labelId = "directory-select-label",
  includeRoot = true,
  rootLabel = ROOT_PARENT_LABEL,
}) => {
  const handleChange = (event: SelectChangeEvent<string>) => {
    onChange(String(event.target.value));
  };

  return (
    <FormControl fullWidth>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        id={id}
        label={label}
        value={value}
        onChange={handleChange}
      >
        {includeRoot && <MenuItem value={ROOT_PARENT_ID}>{rootLabel}</MenuItem>}
        {options.map((option) => (
          <MenuItem key={option.id} value={option.id}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
