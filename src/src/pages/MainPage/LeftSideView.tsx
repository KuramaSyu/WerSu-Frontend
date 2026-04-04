import { Box, Stack } from "@mui/material";
import { DirectorySideView } from "./DirectorySideView";
import { M4 } from "../../statics";
import { IconButton, Paper } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useState } from "react";

const LEFT_OPEN = 280;
const LEFT_CLOSED = 0; // fully hidden pane
const TOGGLE_SIZE = 30;

export interface LeftSideViewProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}
export const LeftSideView: React.FC<LeftSideViewProps> = ({
  open,
  setOpen,
}) => {
  const leftWidth = open ? LEFT_OPEN : LEFT_CLOSED;

  return (
    <>
      <Paper
        elevation={8}
        sx={{
          width: `${leftWidth}px`,
          flex: `0 0 ${leftWidth}px`,
          overflow: "hidden",
          transition: "width 220ms ease, flex-basis 220ms ease",
          position: "sticky",
          top: 16,
          alignSelf: "flex-start",
        }}
      >
        <DirectorySideView />
      </Paper>

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
        {open ? (
          <ChevronLeftIcon fontSize="small" />
        ) : (
          <ChevronRightIcon fontSize="small" />
        )}
      </IconButton>
    </>
  );
};
