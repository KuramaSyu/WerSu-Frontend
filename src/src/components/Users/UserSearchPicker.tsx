import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Avatar,
  Chip,
  Stack,
  TextField,
  Typography,
  type SxProps,
  type Theme,
} from "@mui/material";
import { useSearchUsers } from "../../api/queries/userSearchQueries";
import type { SearchUserReply } from "../../api/models/userManagement";
import { userAvatarSrc, userInitial } from "./userAvatar";

export interface UserSearchPickerProps {
  /** Selected user id. Empty string means "nothing picked". */
  value: string;
  onChange: (userId: string) => void;
  label?: string;
  helperText?: string;
  size?: "small" | "medium";
  sx?: SxProps<Theme>;
}

const labelFor = (user: SearchUserReply): string =>
  user.username || user.id || "Unknown user";

const sameUser = (a: SearchUserReply, b: SearchUserReply): boolean =>
  a.id === b.id;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (value === debounced) return;
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs, debounced]);
  return debounced;
}

/**
 * Authenticated user search + picker backed by `GET /api/users/search`.
 *
 * Shows at most the ten hits the backend returns. The current value is
 * kept visible as a stub option while a new search is in flight so the
 * selection never flashes away.
 */
export const UserSearchPicker: React.FC<UserSearchPickerProps> = ({
  value,
  onChange,
  label = "User",
  helperText = "Search by username, id fragment, or exact email.",
  size = "small",
  sx,
}) => {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const searchQuery = useSearchUsers(debouncedQuery);

  const results = useMemo(() => searchQuery.data ?? [], [searchQuery.data]);

  const options = useMemo(() => {
    if (!value) return results;
    if (results.some((user) => user.id === value)) return results;
    return [{ id: value, username: value } as SearchUserReply, ...results];
  }, [results, value]);

  const selected = useMemo(
    () => options.find((user) => user.id === value) ?? null,
    [options, value],
  );

  return (
    <Stack sx={{ minWidth: 240, ...sx }}>
      <Autocomplete<SearchUserReply, false, false, false>
        options={options}
        value={selected}
        onChange={(_event, next) => onChange(next?.id ?? "")}
        onInputChange={(_event, next) => setQuery(next)}
        getOptionLabel={labelFor}
        isOptionEqualToValue={sameUser}
        filterOptions={(optionList) => optionList}
        renderValue={(option, getItemProps) => (
          <Chip
            key={option.id}
            {...getItemProps()}
            avatar={
              <Avatar
                src={userAvatarSrc(option)}
                alt={labelFor(option)}
                sx={{ width: 20, height: 20 }}
              >
                {userInitial(option)}
              </Avatar>
            }
            label={labelFor(option)}
          />
        )}
        loading={searchQuery.isFetching}
        noOptionsText={
          debouncedQuery.length < 2
            ? "Type at least 2 characters to search"
            : searchQuery.isError
              ? "User search failed"
              : "No users found"
        }
        renderOption={(props, option) => (
          <Stack
            component="li"
            {...props}
            key={option.id}
            direction="row"
            spacing={1}
            sx={{ alignItems: "center" }}
          >
            <Avatar
              src={userAvatarSrc(option)}
              alt={labelFor(option)}
              sx={{ width: 24, height: 24, fontSize: "0.7rem" }}
            >
              {userInitial(option)}
            </Avatar>
            <Stack sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {labelFor(option)}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {option.id}
              </Typography>
            </Stack>
          </Stack>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder="Search users…"
            helperText={helperText}
            size={size}
          />
        )}
      />
    </Stack>
  );
};

export default UserSearchPicker;
