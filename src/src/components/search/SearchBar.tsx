import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Box,
  Button,
  Collapse,
  InputAdornment,
  TextField,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { M4 } from "../../statics";
import { SearchNotesApi } from "../../api/SearchNotesApi";
import { RestNotesSearchType } from "../../api/models/search";
import { useSearchNotesStore } from "../../zustand/useSearchNotesStore";
import SearchStrategySelect from "../SearchStrategySelect";
import SearchResultsOverlay from "../SearchResultsOverlay";
import { isCtrlPlus } from "../../utils/CtrlPlus";
import { set } from "zod";
import { useThemeStore } from "../../zustand/useThemeStore";

const INITIAL_DEBOUCE_DELAY = 500; // to prevent lag in mode selection
const DEBOUNCE_DELAY = 125;

const SearchBar: React.FC = () => {
  const { theme } = useThemeStore();
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [searchType, setSearchType] = useState<RestNotesSearchType>(
    RestNotesSearchType.CONTEXT,
  );

  const { isModalOpen, setIsModalOpen, isSearching, setIsSearching } =
    useSearchNotesStore();
  const location = useLocation();
  const isMainPage = location.pathname === "/";

  useEffect(() => {
    // open search modal with ctrl+k or cmd+k
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isCtrlPlus(event, "k")) {
        event.preventDefault();
        const open = !isModalOpen;
        setIsModalOpen(open);
        setSearchActive(open);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalOpen, setIsModalOpen]);

  // initial search
  //   useEffect(() => {
  //     const SEARCH_LIMIT = 50;
  //     async function search() {
  //       const api = new SearchNotesApi();
  //       await api.search(RestNotesSearchType.LATEST, searchText, SEARCH_LIMIT, 0);
  //     }
  //     search();
  //   }, []);

  // useEffect(() => {
  //   if (isMainPage && isModalOpen) {
  //     setIsModalOpen(false);
  //   }
  // }, [isMainPage, isModalOpen, setIsModalOpen]);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 1 }}>
      {/* <Collapse
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
      </Collapse> */}

      <Box sx={{ width: 360 }}>
        <Button>Search</Button>
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
