import React, { useEffect, useState } from "react";
import { Box, Collapse, InputAdornment, TextField } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { M4 } from "../../statics";
import { SearchNotesApi } from "../../api/SearchNotesApi";
import { RestNotesSearchType } from "../../api/models/search";
import { useSearchNotesStore } from "../../zustand/useSearchNotesStore";
import SearchStrategySelect from "../SearchStrategySelect";
import SearchResultsOverlay from "../SearchResultsOverlay";

const INITIAL_DEBOUCE_DELAY = 500; // to prevent lag in mode selection
const DEBOUNCE_DELAY = 125;

const SearchBar: React.FC = () => {
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [searchType, setSearchType] = useState<RestNotesSearchType>(
    RestNotesSearchType.CONTEXT,
  );

  const { isModalOpen, setIsModalOpen, isSearching, setIsSearching } =
    useSearchNotesStore();

  // initial search
  //   useEffect(() => {
  //     const SEARCH_LIMIT = 50;
  //     async function search() {
  //       const api = new SearchNotesApi();
  //       await api.search(RestNotesSearchType.LATEST, searchText, SEARCH_LIMIT, 0);
  //     }
  //     search();
  //   }, []);

  // debounce search input so typing stays responsive
  useEffect(() => {
    if (!searchActive || searchText === "") {
      setDebouncedSearchText(searchText);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, DEBOUNCE_DELAY);

    return () => window.clearTimeout(timeoutId);
  }, [searchText, searchActive]);

  // perform search
  useEffect(() => {
    if (debouncedSearchText === "") {
      return;
    }
    const SEARCH_LIMIT = 50;
    async function search() {
      setIsSearching(true);
      const api = new SearchNotesApi();
      if (searchText === "") {
        await api.search(
          RestNotesSearchType.LATEST,
          searchText,
          SEARCH_LIMIT,
          0,
        );
      } else {
        await api.search(searchType, debouncedSearchText, SEARCH_LIMIT, 0);
      }
      setIsSearching(false);
    }
    if (searchActive) {
      search();
    }
  }, [debouncedSearchText, searchType, searchActive, setIsSearching]);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 1 }}>
      <Collapse
        in={searchText !== "" || searchActive}
        timeout={300}
        orientation="horizontal"
      >
        <Box>
          <SearchStrategySelect
            searchType={searchType}
            setSearchType={setSearchType}
          />
        </Box>
      </Collapse>

      <Box sx={{ width: 360 }}>
        <TextField
          fullWidth
          placeholder="Search"
          variant="outlined"
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            if (e.target.value && searchActive) {
              setIsModalOpen(true);
            }
          }}
          onFocus={() => {
            setSearchActive(true);
            if (searchText) {
              setIsModalOpen(true);
            }
          }}
          onBlur={() => setSearchActive(false)}
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

      <SearchResultsOverlay
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isLoading={isSearching}
        searchQuery={debouncedSearchText}
        searchType={searchType}
      />
    </Box>
  );
};

export default SearchBar;
