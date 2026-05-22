import React, { memo } from "react";
import { ToggleButtonGroup, ToggleButton } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { M4 } from "../statics";
import { RestNotesSearchType } from "../api/models/search";

interface Props {
  searchType: RestNotesSearchType;
  setSearchType: (t: RestNotesSearchType) => void;
}

const SearchStrategySelect: React.FC<Props> = ({
  searchType,
  setSearchType,
}) => {
  return (
    <ToggleButtonGroup
      value={searchType}
      exclusive
      onChange={(_event, newSearchType) => {
        if (newSearchType !== null) {
          setSearchType(newSearchType as RestNotesSearchType);
        }
      }}
      aria-label="search type"
      sx={{
        borderRadius: M4,
        "& .MuiToggleButton-root": {
          whiteSpace: "nowrap",
        },
      }}
      color="secondary"
    >
      <ToggleButton
        color="secondary"
        value={RestNotesSearchType.KEYWORD}
        aria-label="keyword"
        sx={{
          borderTopLeftRadius: M4,
          borderBottomLeftRadius: M4,
          gap: 1,
        }}
      >
        <SearchIcon /> keyword
      </ToggleButton>
      <ToggleButton
        value={RestNotesSearchType.TYPO_TOLERANT}
        aria-label="typo tolerant"
        sx={{ gap: 1 }}
      >
        <ManageSearchIcon /> typo tolerant
      </ToggleButton>
      <ToggleButton
        value={RestNotesSearchType.CONTEXT}
        aria-label="context"
        sx={{
          borderTopRightRadius: M4,
          borderBottomRightRadius: M4,
          gap: 1,
        }}
      >
        <AutoAwesomeIcon /> context
      </ToggleButton>
    </ToggleButtonGroup>
  );
};

export default memo(SearchStrategySelect);
