import React, { memo } from "react";
import { ToggleButtonGroup, ToggleButton, Tooltip } from "@mui/material";
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
      <Tooltip title="Keyword: Search for exact matches">
        <ToggleButton
          color="secondary"
          value={RestNotesSearchType.KEYWORD}
          aria-label="keyword"
          sx={{
            borderTopLeftRadius: M4,
            borderBottomLeftRadius: M4,
            gap: 1,
            minWidth: 80,
          }}
        >
          <SearchIcon />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Typo Tolerant: Search with typo tolerance">
        <ToggleButton
          value={RestNotesSearchType.TYPO_TOLERANT}
          aria-label="typo tolerant"
          sx={{ gap: 1, minWidth: 80 }}
        >
          <ManageSearchIcon />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Context: Search for notes with similar content">
        <ToggleButton
          value={RestNotesSearchType.CONTEXT}
          aria-label="context"
          sx={{
            borderTopRightRadius: M4,
            borderBottomRightRadius: M4,
            gap: 1,
            minWidth: 80,
          }}
        >
          <AutoAwesomeIcon />
        </ToggleButton>
      </Tooltip>
    </ToggleButtonGroup>
  );
};

export default memo(SearchStrategySelect);
