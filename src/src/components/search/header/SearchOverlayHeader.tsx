import React from "react";
import { Box, Button, InputAdornment, Stack, TextField } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { useThemeStore } from "../../../zustand/useThemeStore";
import { useSearchFilterStore } from "../../../zustand/useSearchFilterStore";
import SearchStrategySelect from "../../SearchStrategySelect";
import { KeyboardShortcut } from "../../../utils/renderShortcut";
import { M4 } from "../../../statics";
import { useDebouncedSearchSync } from "./SearchOverlayHeader.hook";

interface Props {
  onClose: () => void;
}

// top row: search strategy, query input, close button.
// subscribes only to `search` + `searchType` so keystrokes don't
// ripple into the filter or results list
export const SearchOverlayHeader: React.FC<Props> = ({ onClose }) => {
  const theme = useThemeStore((s) => s.theme);
  const search = useSearchFilterStore((s) => s.search);
  const searchType = useSearchFilterStore((s) => s.searchType);
  const setSearch = useSearchFilterStore((s) => s.setSearch);
  const setSearchType = useSearchFilterStore((s) => s.setSearchType);

  useDebouncedSearchSync(search);

  return (
    <Stack
      direction="row"
      sx={{
        justifyContent: "space-between",
        alignItems: "center",
        position: "sticky",
      }}
    >
      <Box sx={{ width: "20%" }}>
        <SearchStrategySelect
          searchType={searchType}
          setSearchType={setSearchType}
          color="primary"
        />
      </Box>

      <Box sx={{ width: "60%", justifyContent: "center", display: "flex" }}>
        <TextField
          autoFocus
          placeholder="Search"
          variant="outlined"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          color="primary"
          sx={{ width: "fit-content", minWidth: "50%", maxWidth: "100%" }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: "1rem" }} />
                </InputAdornment>
              ),
              sx: {
                borderRadius: M4,
                "& .MuiOutlinedInput-input": {
                  padding: "calc(1em / 1.6) 0.5rem",
                },
              },
            },
          }}
        />
      </Box>

      <Box sx={{ width: "20%", justifyContent: "flex-end", display: "flex" }}>
        <Button
          size="large"
          variant="outlined"
          onClick={onClose}
          color="primary"
          sx={{
            px: 4,
            gap: 1,
            width: "20%",
            borderRadius: theme.shape.borderRadius,
          }}
        >
          <CloseIcon fontSize="medium" />
          <KeyboardShortcut shortcut="esc" onlyText={true} />
        </Button>
      </Box>
    </Stack>
  );
};

export default SearchOverlayHeader;
