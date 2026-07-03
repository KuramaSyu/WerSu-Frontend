import { Box, IconButton, Paper, Stack, Tooltip } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

const LEFT_OPEN = 280;
const LEFT_CLOSED = 0; // fully hidden pane
const TOGGLE_SIZE = 30;

export interface RightSidePanelProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  children?: React.ReactNode;
}
export const RightSidePanel: React.FC<RightSidePanelProps> = ({
  open,
  setOpen,
  children,
}) => {
  const leftWidth = open ? LEFT_OPEN : LEFT_CLOSED;

  return (
    <>
      <Paper
        elevation={1}
        sx={{
          width: `${leftWidth}px`,
          flex: `0 0 ${leftWidth}px`,
          overflow: "hidden",
          transition: "width 220ms ease, flex-basis 220ms ease",
          position: "sticky",
          top: 16,
          alignSelf: "flex-start",
        }}
      ></Paper>

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
