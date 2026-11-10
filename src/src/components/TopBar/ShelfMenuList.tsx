import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  CircularProgress,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
  alpha,
  type Theme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckIcon from "@mui/icons-material/Check";
import EditIcon from "@mui/icons-material/Edit";
import InboxIcon from "@mui/icons-material/Inbox";
import SettingsIcon from "@mui/icons-material/Settings";
import { M2 } from "../../statics";
import { useShelfSelection } from "./useShelfSelection";

export interface ShelfMenuListProps {
  /** Called after the user picks a shelf (or "All shelves"). */
  onPick?: () => void;
  /** Called after navigating to a shelf's rules or edit page. */
  onNavigate?: () => void;
  /** Called when the user asks to create a new shelf. */
  onAddShelf: () => void;
  /** Hide the "Add new shelf" row (e.g. for anonymous public viewers). */
  canAdd?: boolean;
  /**
   * Desktop menus reveal the row actions on hover. Touch surfaces
   * have no hover, so pass `false` there to keep the actions visible.
   */
  revealEditActionsOnHover?: boolean;
}

const rowSx = (revealOnHover: boolean) => ({
  mx: 0.75,
  my: 0.25,
  px: 1.25,
  py: 1.25,
  gap: 1.5,
  borderRadius: 1.5,
  alignItems: "center",
  "&.Mui-selected": {
    backgroundColor: (t: Theme) => alpha(t.palette.primary.main, 0.1),
  },
  "&.Mui-selected:hover": {
    backgroundColor: (t: Theme) => alpha(t.palette.primary.main, 0.14),
  },
  ...(revealOnHover
    ? {
        "& .shelf-menu-edit": { opacity: 0 },
        "&:hover .shelf-menu-edit, &:focus-within .shelf-menu-edit": {
          opacity: 1,
        },
      }
    : {}),
});

const iconBoxSx = {
  display: "grid",
  placeItems: "center",
  width: 34,
  height: 34,
  flexShrink: 0,
  borderRadius: 1.5,
  fontSize: "0.875rem",
  fontWeight: 700,
} as const;

/**
 * The option rows shared by the desktop top bar's shelf menu and the
 * mobile user menu's Shelf section. It deliberately renders no header:
 * both callers supply their own section label.
 */
export const ShelfMenuList: React.FC<ShelfMenuListProps> = ({
  onPick,
  onNavigate,
  onAddShelf,
  canAdd = true,
  revealEditActionsOnHover = true,
}) => {
  const navigate = useNavigate();
  const { shelves, isLoading, selectedShelfId, setSelectedShelfId } =
    useShelfSelection();

  const handlePick = (id: string | null) => {
    setSelectedShelfId(id);
    onPick?.();
  };

  const openRulesForShelf = (shelfId: string) => {
    onNavigate?.();
    navigate(`/shelves/${shelfId}?tab=rules`);
  };

  const openEditForShelf = (shelfId: string) => {
    onNavigate?.();
    navigate(`/shelves/${shelfId}?tab=settings`);
  };

  // The row's own select handler must not fire when an action icon is
  // clicked, or opening rules would also pick that shelf.
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

  const rowStyles = rowSx(revealEditActionsOnHover);

  return (
    <>
      <MenuItem
        selected={selectedShelfId === null}
        onClick={() => handlePick(null)}
        sx={rowStyles}
      >
        <Box
          sx={{
            ...iconBoxSx,
            backgroundColor:
              selectedShelfId === null
                ? (t: Theme) => alpha(t.palette.primary.main, 0.16)
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
              sx={rowStyles}
            >
              <Box
                sx={{
                  ...iconBoxSx,
                  backgroundColor: isActive
                    ? (t: Theme) => alpha(t.palette.primary.main, 0.16)
                    : "action.hover",
                  color: isActive ? "primary.main" : "text.secondary",
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
                        backgroundColor: (t: Theme) =>
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
            secondary="Create one with the option below"
          />
        </MenuItem>
      )}

      {canAdd && (
        <>
          <Divider sx={{ mx: 0.75, my: 0.5 }} />
          <MenuItem onClick={onAddShelf} sx={rowStyles}>
            <Box
              sx={{
                ...iconBoxSx,
                backgroundColor: (t: Theme) =>
                  alpha(t.palette.primary.main, 0.12),
                color: "primary.main",
              }}
            >
              <AddIcon fontSize="small" />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Add new shelf
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                Create a new workspace
              </Typography>
            </Box>
          </MenuItem>
        </>
      )}
    </>
  );
};
