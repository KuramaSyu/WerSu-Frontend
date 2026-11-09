import React, { useState } from "react";
import { ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ShelvesIcon from "@mui/icons-material/Shelves";
import { ShelfMenuList } from "./ShelfMenuList";
import { useShelfSelection } from "./useShelfSelection";

export interface ShelfSubmenuProps {
  /** Fired after a shelf is picked or the user navigates away. */
  onRequestClose: () => void;
  /** Called when the user asks to create a new shelf. */
  onAddShelf: () => void;
  /** Hide the "Add new shelf" row (e.g. for anonymous public viewers). */
  canAdd?: boolean;
}

/**
 * A single "Shelf" row that opens a nested menu listing every shelf.
 * Replaces the inline shelf list that used to sit in the avatar menu,
 * keeping the menu compact on phones.
 */
export const ShelfSubmenu: React.FC<ShelfSubmenuProps> = ({
  onRequestClose,
  onAddShelf,
  canAdd = true,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { activeShelf } = useShelfSelection();
  const open = Boolean(anchorEl);

  const currentLabel = activeShelf
    ? activeShelf.display_name || activeShelf.slug || "Shelf"
    : "All shelves";

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handlePick = () => {
    handleClose();
    onRequestClose();
  };

  const handleNavigate = () => {
    handleClose();
    onRequestClose();
  };

  const handleAddShelf = () => {
    handleClose();
    onAddShelf();
  };

  return (
    <>
      <MenuItem
        onClick={handleOpen}
        selected={open}
        aria-haspopup="menu"
        aria-expanded={open}
        sx={{
          mx: 0.75,
          my: 0.125,
          px: 1.25,
          minHeight: 44,
          gap: 1,
          borderRadius: 1.5,
          "&:hover": { backgroundColor: "action.hover" },
          "& .MuiListItemIcon-root": { minWidth: 32, color: "text.secondary" },
          "&:hover .MuiListItemIcon-root": { color: "primary.main" },
        }}
      >
        <ListItemIcon>
          <ShelvesIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary="Shelf"
          secondary={currentLabel}
          slotProps={{ secondary: { variant: "caption", noWrap: true } }}
        />
        <ChevronRightIcon fontSize="small" sx={{ color: "text.secondary" }} />
      </MenuItem>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              width: 320,
              maxWidth: "calc(100vw - 2rem)",
              maxHeight: "70vh",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              overflowY: "auto",
              py: 0.75,
            },
          },
        }}
      >
        <ShelfMenuList
          onPick={handlePick}
          onNavigate={handleNavigate}
          onAddShelf={handleAddShelf}
          canAdd={canAdd}
          revealEditActionsOnHover={false}
        />
      </Menu>
    </>
  );
};

export default ShelfSubmenu;
