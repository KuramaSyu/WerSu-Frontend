import React, { memo } from "react";
import {
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  Collapse,
  Typography,
  Box,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { M4 } from "../statics";
import { RestNotesSearchType } from "../api/models/search";
import CollapseToggleButton from "./CollapseToggleButton";

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
        py: 0,
        my: 0,
      }}
      // color="inherit"
    >
      <Tooltip title="Keyword: Search for exact matches">
        <CollapseToggleButton
          whenSelected={<Box sx={{ whiteSpace: "nowrap" }}>Keyword</Box>}
          selected={searchType === RestNotesSearchType.KEYWORD}
          color={color}
          value={RestNotesSearchType.KEYWORD}
          aria-label="keyword"
          sx={{
            borderTopLeftRadius: M4,
            borderBottomLeftRadius: M4,
            gap: 1,
          }}
        >
          <SearchIcon />
        </CollapseToggleButton>
      </Tooltip>
      <Tooltip title="Typo Tolerant: Search with typo tolerance">
        <CollapseToggleButton
          whenSelected={<Box>Fuzzy</Box>}
          selected={searchType === RestNotesSearchType.TYPO_TOLERANT}
          color={color}
          value={RestNotesSearchType.TYPO_TOLERANT}
          aria-label="typo tolerant"
          sx={{ gap: 1 }}
        >
          <ManageSearchIcon />
        </CollapseToggleButton>
      </Tooltip>
      <Tooltip title="Context: Search for notes with similar content">
        <CollapseToggleButton
          color={color}
          whenSelected={<Box>Context</Box>}
          selected={searchType === RestNotesSearchType.CONTEXT}
          value={RestNotesSearchType.CONTEXT}
          aria-label="context"
          sx={{
            borderTopRightRadius: M4,
            borderBottomRightRadius: M4,
            gap: 1,
          }}
        >
          <AutoAwesomeIcon />
        </CollapseToggleButton>
      </Tooltip>
    </ToggleButtonGroup>
  );
};

export default memo(SearchStrategySelect);
