import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import EditIcon from "@mui/icons-material/Edit";
import InboxIcon from "@mui/icons-material/Inbox";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ShelvesIcon from "@mui/icons-material/Shelves";
import { useShelves } from "../../api/queries/shelfQueries";
import { useSelectedShelfStore } from "../../zustand/useSelectedShelfStore";
import { useThemeStore } from "../../zustand/useThemeStore";
import { M1, M2 } from "../../statics";

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

  const navigate = useNavigate();

  // Rules are scoped to a single shelf (`/shelves/:id/rules`).
  // The edit action on a hovered row jumps straight to that
  // shelf's rules page.
  const openRulesForShelf = (shelfId: string) => {
    handleClose();
    navigate(`/shelves/${shelfId}/rules`);
  };

  // The row's own select handler must not fire when the edit
  // action is clicked, or picking rules would also pick the shelf.
  const handleOpenRules = (
    event: React.MouseEvent<HTMLButtonElement>,
    shelfId: string,
  ) => {
    event.stopPropagation();
    openRulesForShelf(shelfId);
  };

  // Resolve the label through the query so a server-side rename updates on refresh.
  const activeShelf =
    shelves?.find((shelf) => shelf.id === selectedShelfId) ?? null;

  // No stored preference yet and at least one shelf is available:
  // pick the first one so the top bar reflects a real selection.
  useEffect(() => {
    if (selectedShelfId === null && shelves && shelves.length > 0) {
      setSelectedShelfId(shelves[0].id);
    }
  }, [shelves, selectedShelfId, setSelectedShelfId]);
  
  const buttonLabel = activeShelf
    ? activeShelf.display_name || activeShelf.slug || "Shelf"
    : "Shelf";

  console.log("active shelf: ", activeShelf);

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
                sx={{
                  "& .shelf-menu-edit": { opacity: 0 },
                  "&:hover .shelf-menu-edit, &:focus-within .shelf-menu-edit":
                    { opacity: 1 },
                }}
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
                <Tooltip title="Edit rules" placement="right">
                  <IconButton
                    className="shelf-menu-edit"
                    size="small"
                    aria-label={`Edit rules for ${label}`}
                    onClick={(event) => handleOpenRules(event, shelf.id)}
                    sx={{ ml: 1 }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
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
