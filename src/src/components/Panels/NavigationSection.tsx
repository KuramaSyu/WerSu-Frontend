import React, { useEffect, useState } from "react";
import { IconButton, Stack, Tooltip } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useLocation, useNavigate } from "react-router-dom";
import { PanelSection } from "./PanelSection";
import { navigationMemento } from "../../utils/navigationMemento";
import { M1 } from "../../statics";

/**
 * Left-panel section providing Back / Forward navigation across the
 * navigation memento history.
 *
 * Mirrors the icon style used by the main view's `LeftPanel`: small white
 * `IconButton`s wrapped in `Tooltip`s, rendered in the title row.
 */
export const NavigationSection: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Update button states whenever the location changes.
  useEffect(() => {
    setCanUndo(navigationMemento.canUndo());
    setCanRedo(navigationMemento.canRedo());
  }, [location]);

  const handleBack = () => {
    const target = navigationMemento.undo();
    if (!target) {
      return;
    }
    navigationMemento.skipNextRecord();
    setCanUndo(navigationMemento.canUndo());
    setCanRedo(navigationMemento.canRedo());
    navigate(target);
  };

  const handleForward = () => {
    const target = navigationMemento.redo();
    if (!target) {
      return;
    }
    navigationMemento.skipNextRecord();
    setCanUndo(navigationMemento.canUndo());
    setCanRedo(navigationMemento.canRedo());
    navigate(target);
  };

  const titleAction = (
    <Stack direction="row" spacing={M1}>
      <Tooltip title="Back">
        <span>
          <IconButton onClick={handleBack} size="small" disabled={!canUndo}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Forward">
        <span>
          <IconButton onClick={handleForward} size="small" disabled={!canRedo}>
            <ArrowForwardIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );

  return (
    <PanelSection title="Navigation" titleAction={titleAction}></PanelSection>
  );
};
