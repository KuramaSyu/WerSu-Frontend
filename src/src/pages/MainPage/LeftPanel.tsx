import { Box, IconButton, Stack, Tooltip } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { navigationMemento } from "../../utils/navigationMemento";
import { DirectorySideView } from "./DirectorySideView";
import { UpperPanel } from "../../components/Panels/UpperPanel";

const LEFT_OPEN = 280;
const LEFT_CLOSED = 0; // fully hidden pane
const TOGGLE_SIZE = 30;

export interface LeftSideViewProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  children?: React.ReactNode;
}

/**
 * Left-side rail for the home content view. Renders the back / forward
 * / collapse header and delegates the panel shell to `UpperPanel` so
 * the styling stays in one place.
 *
 * `open` / `setOpen` drive the rail's slide animation; the panel body
 * is always mounted so the header chrome stays in sync.
 */
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
      <Box
        sx={{
          width: "100%",
          flex: `0 0 ${leftWidth}px`,
          transition: "flex-basis 220ms ease",
          alignSelf: "flex-start",
          height: "100%",
        }}
      >
        <UpperPanel
          header={
            <Stack
              direction="row"
              sx={{
                p: 1,
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
          }
        >
          {children ?? <DirectorySideView />}
        </UpperPanel>
      </Box>

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
            bgcolor: (theme) => theme.palette.surfaces.panel,
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
