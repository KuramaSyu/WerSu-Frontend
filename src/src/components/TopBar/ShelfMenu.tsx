import React, { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import InboxIcon from "@mui/icons-material/Inbox";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ShelvesIcon from "@mui/icons-material/Shelves";
import { useShelves } from "../../api/queries/shelfQueries";
import { useSelectedShelfStore } from "../../zustand/useSelectedShelfStore";
import { useThemeStore } from "../../zustand/useThemeStore";
import { M1, M2, M3 } from "../../statics";

// Shelf selector next to the WerSu wordmark.
// Reads shelves from useShelves, stores the pick in useSelectedShelfStore.
const ShelfMenuImpl: React.FC = () => {
  const { theme } = useThemeStore();
  const selectedShelfId = useSelectedShelfStore((s) => s.selectedShelfId);
  const setSelectedShelfId = useSelectedShelfStore((s) => s.setSelectedShelfId);
  // include_books=true so the menu can show binding counts without a second request.
  const { data: shelves, isLoading } = useShelves({ include_books: true });

  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchor(event.currentTarget);
  };
  const handleClose = () => {
    setAnchor(null);
  };
  const handlePick = (id: string | null) => {
    setSelectedShelfId(id);
    handleClose();
  };

  // Resolve the label through the query so a server-side rename updates on refresh.
  const activeShelf =
    shelves?.find((shelf) => shelf.id === selectedShelfId) ?? null;
  const buttonLabel = activeShelf
    ? activeShelf.display_name || activeShelf.slug || "Shelf"
    : "Shelf";

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
          fontWeight: 400,
          fontSize: theme.typography.body1.fontSize,
          color: theme.palette.text.primary,
          px: M2,
          minWidth: 0,
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
            sx: { minWidth: 240, maxWidth: "calc(100vw - 2rem)" },
          },
        }}
      >
        <MenuItem
          selected={selectedShelfId === null}
          onClick={() => handlePick(null)}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            {selectedShelfId === null ? (
              <CheckIcon fontSize="small" />
            ) : (
              <Box sx={{ width: 20, height: 20 }} />
            )}
          </ListItemIcon>
          <ListItemText primary="All shelves" />
        </MenuItem>
        <Divider />
        {isLoading ? (
          <Stack
            direction="row"
            spacing={M2}
            sx={{ alignItems: "center", px: M2, py: M2 }}
          >
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Loading shelves...
            </Typography>
          </Stack>
        ) : shelves && shelves.length > 0 ? (
          shelves.map((shelf) => {
            const isActive = shelf.id === selectedShelfId;
            const label = shelf.display_name || shelf.slug || shelf.id;
            const bookCount = shelf.book_ids?.length ?? 0;
            return (
              <MenuItem
                key={shelf.id}
                selected={isActive}
                onClick={() => handlePick(shelf.id)}
                title={label}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {isActive ? (
                    <CheckIcon fontSize="small" />
                  ) : (
                    <InboxIcon fontSize="small" color="disabled" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={label}
                  secondary={bookCount > 0 ? `${bookCount} books` : undefined}
                />
              </MenuItem>
            );
          })
        ) : (
          <MenuItem disabled>
            <ListItemText
              primary="No shelves yet"
              secondary="Create one from the directory tree"
            />
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

export const ShelfMenu = React.memo(ShelfMenuImpl);
