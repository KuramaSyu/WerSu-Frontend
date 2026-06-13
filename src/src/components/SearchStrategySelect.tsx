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
  color: "primary" | "secondary" | "standard" | "error" | "info" | "success";
}

const SearchStrategySelect: React.FC<Props> = ({
  searchType,
  setSearchType,
  color,
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
      color={color}
      aria-label="search type"
      sx={{
        borderRadius: M4,
        width: "100%",
      }}
      // color="inherit"
    >
      <Tooltip title="Keyword: Search for exact matches">
        <ToggleButton
          color={color}
          value={RestNotesSearchType.KEYWORD}
          aria-label="keyword"
          sx={{
            borderTopLeftRadius: M4,
            borderBottomLeftRadius: M4,
            gap: 1,
            width: "33.3%",
          }}
        >
          <SearchIcon />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Typo Tolerant: Search with typo tolerance">
        <ToggleButton
          color={color}
          value={RestNotesSearchType.TYPO_TOLERANT}
          aria-label="typo tolerant"
          sx={{ gap: 1, width: "33.3%" }}
        >
          <ManageSearchIcon />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Context: Search for notes with similar content">
        <ToggleButton
          color={color}
          value={RestNotesSearchType.CONTEXT}
          aria-label="context"
          sx={{
            borderTopRightRadius: M4,
            borderBottomRightRadius: M4,
            gap: 1,
            width: "33.3%",
          }}
        >
          <AutoAwesomeIcon />
        </ToggleButton>
      </Tooltip>
    </ToggleButtonGroup>
  );
};

export default memo(SearchStrategySelect);
