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
  alpha,
} from "@mui/material";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckIcon from "@mui/icons-material/Check";
import EditIcon from "@mui/icons-material/Edit";
import InboxIcon from "@mui/icons-material/Inbox";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import SettingsIcon from "@mui/icons-material/Settings";
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
  const hasChosenShelf = useSelectedShelfStore((s) => s.hasChosenShelf);
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

  const openEditForShelf = (shelfId: string) => {
    handleClose();
    navigate(`/shelves/${shelfId}/edit`);
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

  const handleOpenEdit = (
    event: React.MouseEvent<HTMLButtonElement>,
    shelfId: string,
  ) => {
    event.stopPropagation();
    openEditForShelf(shelfId);
  };   

  // Resolve the label through the query so a server-side rename updates on refresh.
  const activeShelf =
    shelves?.find((shelf) => shelf.id === selectedShelfId) ?? null;

  // First load only: if the user has never made a choice, start on the
  // first shelf. Once they pick a shelf or "All shelves", their choice
  // (including `null`) is respected and persisted.
  useEffect(() => {
    if (
      !hasChosenShelf &&
      selectedShelfId === null &&
      shelves &&
      shelves.length > 0
    ) {
      setSelectedShelfId(shelves[0].id);
    }
  }, [shelves, selectedShelfId, hasChosenShelf, setSelectedShelfId]);
  
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
            },
          },
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            backgroundColor: (t) =>
              alpha(
                t.palette.primary.main,
                t.palette.mode === "dark" ? 0.08 : 0.05,
              ),
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                display: "grid",
                placeItems: "center",
                width: 34,
                height: 34,
                flexShrink: 0,
                borderRadius: 1.5,
                backgroundColor: (t) => alpha(t.palette.primary.main, 0.14),
                color: "primary.main",
              }}
            >
              <ShelvesIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="overline"
                sx={{
                  display: "block",
                  lineHeight: 1.2,
                  color: "text.secondary",
                  letterSpacing: "0.08em",
                }}
              >
                Workspace
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, lineHeight: 1.3 }}
              >
                Shelves
              </Typography>
            </Box>
          </Stack>
        </Box>

        <MenuItem
          selected={selectedShelfId === null}
          onClick={() => handlePick(null)}
          sx={{
            mx: 0.75,
            my: 0.25,
            px: 1.25,
            py: 1.25,
            gap: 1.5,
            borderRadius: 1.5,
            alignItems: "center",
            "&.Mui-selected": {
              backgroundColor: (t) => alpha(t.palette.primary.main, 0.1),
            },
            "&.Mui-selected:hover": {
              backgroundColor: (t) => alpha(t.palette.primary.main, 0.14),
            },
          }}
        >
          <Box
            sx={{
              display: "grid",
              placeItems: "center",
              width: 34,
              height: 34,
              flexShrink: 0,
              borderRadius: 1.5,
              backgroundColor:
                selectedShelfId === null
                  ? (t) => alpha(t.palette.primary.main, 0.16)
                  : "action.hover",
              color:
                selectedShelfId === null ? "primary.main" : "text.secondary",
            }}
          >
            {selectedShelfId === null ? (
              <CheckIcon fontSize="small" />
            ) : (
              <CheckBoxOutlineBlankIcon fontSize="small" />
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              noWrap
              sx={{ fontWeight: selectedShelfId === null ? 600 : 500 }}
            >
              All shelves
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              Search across everything
            </Typography>
          </Box>
        </MenuItem>

        <Divider sx={{ mx: 0.75, my: 0.5 }} />

        {isLoading ? (
          <Stack
            direction="row"
            spacing={M2}
            sx={{ alignItems: "center", px: 2.25, py: 1.5 }}
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
            const initial = label.trim().charAt(0).toUpperCase() || "?";
            return (
              <MenuItem
                key={shelf.id}
                selected={isActive}
                onClick={() => handlePick(shelf.id)}
                title={label}
                sx={{
                  mx: 0.75,
                  my: 0.25,
                  px: 1.25,
                  py: 1.25,
                  gap: 1.5,
                  borderRadius: 1.5,
                  alignItems: "center",
                  "&.Mui-selected": {
                    backgroundColor: (t) => alpha(t.palette.primary.main, 0.1),
                  },
                  "&.Mui-selected:hover": {
                    backgroundColor: (t) =>
                      alpha(t.palette.primary.main, 0.14),
                  },
                  "& .shelf-menu-edit": { opacity: 0 },
                  "&:hover .shelf-menu-edit, &:focus-within .shelf-menu-edit":
                    { opacity: 1 },
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    placeItems: "center",
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    borderRadius: 1.5,
                    backgroundColor: isActive
                      ? (t) => alpha(t.palette.primary.main, 0.16)
                      : "action.hover",
                    color: isActive ? "primary.main" : "text.secondary",
                    fontSize: "0.875rem",
                    fontWeight: 700,
                  }}
                >
                  {isActive ? <CheckIcon fontSize="small" /> : initial}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.75,
                      minWidth: 0,
                    }}
                  >
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ fontWeight: isActive ? 600 : 500 }}
                    >
                      {label}
                    </Typography>
                    {isActive && (
                      <Box
                        component="span"
                        sx={{
                          flexShrink: 0,
                          px: 0.75,
                          py: 0.125,
                          borderRadius: 999,
                          backgroundColor: (t) =>
                            alpha(t.palette.primary.main, 0.14),
                          color: "primary.main",
                          fontSize: "0.625rem",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}
                      >
                        Current
                      </Box>
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {bookCount > 0
                      ? `${bookCount} book${bookCount === 1 ? "" : "s"}`
                      : "No books yet"}
                  </Typography>
                </Box>

                <Tooltip title="Edit rules" placement="right">
                  <IconButton
                    className="shelf-menu-edit"
                    size="small"
                    aria-label={`Edit rules for ${label}`}
                    onClick={(event) => handleOpenRules(event, shelf.id)}
                    sx={{ ml: 0.5, flexShrink: 0 }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Edit shelf / theme" placement="right">
                  <IconButton
                    className="shelf-menu-edit"
                    size="small"
                    aria-label={`Edit shelf ${label}`}
                    onClick={(event) => handleOpenEdit(event, shelf.id)}
                    sx={{ ml: 0.25, flexShrink: 0 }}
                  >
                    <SettingsIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </MenuItem>
            );
          })
        ) : (
          <MenuItem disabled sx={{ mx: 0.75, borderRadius: 1.5 }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <InboxIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="No shelves yet"
              secondary="Create one from the book tree"
            />
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

export const ShelfMenu = React.memo(ShelfMenuImpl);
