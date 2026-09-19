import React from "react";
import {
  Box,
  Button,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useNavigate } from "react-router-dom";
import {
  SEARCH_TYPE_NO_OVERRIDE,
  useSearchSettings,
} from "../../../zustand/useSearchSettings";
import { RestNotesSearchType } from "../../../api/models/search";
import { Pages } from "../../TopBar/Pages";

// Pretty label per wire value, mirroring SearchStrategySelect +
// SearchSection so every surface names a mode the same way.
const TYPE_LABEL: Record<RestNotesSearchType, string> = {
  [RestNotesSearchType.KEYWORD]: "Keyword",
  [RestNotesSearchType.TYPO_TOLERANT]: "Fuzzy",
  [RestNotesSearchType.CONTEXT]: "Context",
  [RestNotesSearchType.LATEST]: "Latest",
};

// (i) indicator shown when the current mode matches the user's
// chosen default; tooltip links out to Settings.
export const SearchTypeOverrideHint: React.FC<{ current: RestNotesSearchType }> = ({
  current,
}) => {
  const defaultSearchType = useSearchSettings((s) => s.defaultSearchType);
  const navigate = useNavigate();

  // Hide when the user hasn't pinned a default or has drifted away
  // from it; both states mean there's nothing to explain.
  if (defaultSearchType === SEARCH_TYPE_NO_OVERRIDE) return null;
  if (current !== defaultSearchType) return null;

  return (
    <Tooltip
      arrow
      placement="bottom"
      disableInteractive={false}
      slotProps={{
        popper: { disablePortal: true },
        tooltip: { sx: { maxWidth: 280, p: 2, borderRadius: 3 } },
      }}
      title={
        <Stack spacing={1.5}>
          <Typography variant="body2">
            This is the default search mode, because {TYPE_LABEL[current]} was
            selected in the settings.
          </Typography>
          <Box>
            <Button
              size="small"
              variant="text"
              onClick={(event) => {
                event.stopPropagation();
                navigate(Pages.SETTINGS);
              }}
              // Tooltip closes on leave; without preventDefault the
              // button steals focus mid-hover and hides the tooltip.
              onMouseDown={(event) => event.preventDefault()}
            >
              Change in Settings
            </Button>
          </Box>
        </Stack>
      }
    >
      <Box
        role="img"
        aria-label="Why this search mode?"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "text.secondary",
          cursor: "help",
          p: 0.25,
          borderRadius: "50%",
        }}
      >
        <InfoOutlinedIcon fontSize="small" />
      </Box>
    </Tooltip>
  );
};