import React, { useState } from "react";
import { Box, Button, Menu } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ShelvesIcon from "@mui/icons-material/Shelves";
import { M1, M2 } from "../../statics";
import { useThemeStore } from "../../zustand/useThemeStore";
import { ShelfCreateDialog } from "./ShelfCreateDialog";
import { ShelfMenuList } from "./ShelfMenuList";
import { useShelfSelection } from "./useShelfSelection";

// Shelf selector next to the WerSu wordmark.
// Reads shelves through `useShelfSelection`, stores the pick in
// `useSelectedShelfStore`. The option rows themselves are shared with
// the mobile user menu's Shelf section.
const ShelfMenuImpl: React.FC = () => {
  const { theme } = useThemeStore();
  const { activeShelf } = useShelfSelection();

  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const open = Boolean(anchor);

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchor(event.currentTarget);
  };
  const handleClose = () => {
    setAnchor(null);
  };
  const handleAddShelf = () => {
    handleClose();
    setIsCreateOpen(true);
  };

  const buttonLabel = activeShelf
    ? activeShelf.display_name || activeShelf.slug || "Shelf"
    : "All shelves";

  return (
    <>
      <Button
        onClick={handleOpen}
        size="small"
        variant="text"
        color="inherit"
        startIcon={<ShelvesIcon fontSize="small" />}
        endIcon={<KeyboardArrowDownIcon fontSize="small" />}
        aria-label="Select shelf"
        aria-haspopup="menu"
        sx={{
          textTransform: "none",
          fontWeight: 500,
          fontSize: theme.typography.body1.fontSize,
          color: theme.palette.text.primary,
          px: M2,
          minWidth: 0,
          borderRadius: 1.5,
          backgroundColor: "transparent",
          "&:hover": {
            backgroundColor: theme.palette.action.hover,
          },
          // Cap so a long name does not push the centred search bar off-axis.
          maxWidth: "16rem",
          "& .MuiButton-endIcon": {
            ml: M1,
          },
        }}
      >
        <Box
          component="span"
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {buttonLabel}
        </Box>
      </Button>

      <Menu
        anchorEl={anchor}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              width: 320,
              maxWidth: "calc(100vw - 2rem)",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              overflow: "hidden",
              py: 0.75,
            },
          },
        }}
      >
        <ShelfMenuList
          onPick={handleClose}
          onNavigate={handleClose}
          onAddShelf={handleAddShelf}
        />
      </Menu>

      {isCreateOpen && (
        <ShelfCreateDialog
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
    </>
  );
};

export const ShelfMenu = React.memo(ShelfMenuImpl);
