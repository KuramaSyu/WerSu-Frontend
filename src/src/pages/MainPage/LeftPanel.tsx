import { Box, IconButton, Paper, Stack, Tooltip } from "@mui/material";
import { DirectorySideView } from "./DirectorySideView";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { navigationMemento } from "../../utils/navigationMemento";

const LEFT_OPEN = 280;
const LEFT_CLOSED = 0; // fully hidden pane
const TOGGLE_SIZE = 30;

export interface LeftSideViewProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  children?: React.ReactNode;
}
export const LeftPanel: React.FC<LeftSideViewProps> = ({
  open,
  setOpen,
  children,
}) => {
  const leftWidth = open ? LEFT_OPEN : LEFT_CLOSED;
  const navigate = useNavigate();
  const location = useLocation();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Update button states whenever the location changes.
  useEffect(() => {
    setCanUndo(navigationMemento.canUndo());
    setCanRedo(navigationMemento.canRedo());
  }, [location]);

  const handleUndo = () => {
    const target = navigationMemento.undo();
    if (!target) {
      return;
    }

    navigationMemento.skipNextRecord();
    setCanUndo(navigationMemento.canUndo());
    setCanRedo(navigationMemento.canRedo());
    navigate(target);
  };

  const handleRedo = () => {
    const target = navigationMemento.redo();
    if (!target) {
      return;
    }

    navigationMemento.skipNextRecord();
    setCanUndo(navigationMemento.canUndo());
    setCanRedo(navigationMemento.canRedo());
    navigate(target);
  };

  return (
    <>
      <Paper
        elevation={1}
        sx={{
          width: `clamp(250px, 100%, 400px)`,
          flex: `0 0 ${leftWidth}px`,
          overflow: "hidden",
          transition: "width 220ms ease, flex-basis 220ms ease",
          // position: "sticky",
          alignSelf: "flex-start",
        }}
      >
        <Box
          sx={{
            height: "100%",
            width: "100%",
            overflowY: "auto",
          }}
        >
          <Stack
            direction="row"
            sx={{
              p: 1.5,
              borderBottom: "1px solid",
              borderColor: "divider",
              justifyContent: "space-between",
            }}
          >
            <Stack direction={"row"}>
              <Tooltip title="Back">
                <span>
                  <IconButton
                    onClick={handleUndo}
                    size="small"
                    disabled={!canUndo}
                  >
                    <ArrowBackIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Forward">
                <span>
                  <IconButton
                    onClick={handleRedo}
                    size="small"
                    disabled={!canRedo}
                  >
                    <ArrowForwardIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
            <Tooltip title={open ? "Collapse" : "Expand"}>
              <IconButton onClick={() => setOpen((v) => !v)} size="small">
                {open ? (
                  <ChevronLeftIcon fontSize="small" />
                ) : (
                  <ChevronRightIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </Stack>
          {children ?? <DirectorySideView />}
        </Box>
      </Paper>

      {!open && (
        <IconButton
          onClick={() => setOpen((v) => !v)}
          size="small"
          sx={{
            position: "fixed",
            top: "50vh",
            transform: "translateY(-50%)",
            left: `${Math.max(8, leftWidth - TOGGLE_SIZE / 2)}px`,
            width: TOGGLE_SIZE,
            height: TOGGLE_SIZE,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            boxShadow: 2,
            zIndex: (theme) => theme.zIndex.appBar + 1,
            transition: "left 220ms ease, background-color 120ms ease",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      )}
    </>
  );
};
