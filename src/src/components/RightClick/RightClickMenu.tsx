// Turns resolved rows into MenuItems.
//
// The submenu is hand-rolled because MUI's SubmenuList ships in a
// separate package that this project does not install.

import React, { useEffect, useRef, useState } from "react";
import {
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { renderShortcut } from "../../utils/renderShortcut";
import type {
  ResolvedMenuEntry,
  ResolvedMenuRow,
  RightClickHandler,
  RightClickSubmenu,
} from "./types";

/** Lets the pointer travel diagonally into the submenu without losing it. */
const SUBMENU_CLOSE_DELAY_MS = 150;

/** One raised surface for the menu and its submenu. */
const SURFACE_SX: SxProps<Theme> = {
  minWidth: 200,
  borderRadius: 2,
  border: (theme) => `1px solid ${theme.palette.divider}`,
  overflow: "hidden",
};

/** Denser than the MUI default body1, so menus take less room. */
const ITEM_TEXT_SX: SxProps<Theme> = {
  fontSize: "0.8125rem",
  "& .MuiListItemText-primary": { fontSize: "inherit" },
};

export interface RightClickMenuProps {
  /** Viewport coordinate for the menu. MUI flips it away from edges. */
  anchorPosition: { top: number; left: number };
  rows: ResolvedMenuEntry[];
  /** Same lookup the resolver gated on, so a row fires the handler it was enabled for. */
  getHandler: (row: ResolvedMenuRow) => RightClickHandler | undefined;
  /** Closes the menu, then invokes the handler with the request target. */
  onRun: (handler: RightClickHandler) => void;
  onClose: () => void;
}

function ShortcutHint({ shortcut }: { shortcut?: string }) {
  if (!shortcut) return null;
  return (
    <Typography
      variant="body2"
      color="text.secondary"
      component="span"
      sx={{ fontSize: "0.75rem" }}
    >
      {renderShortcut(shortcut)}
    </Typography>
  );
}

function SubmenuList({
  submenu,
  anchorEl,
  onEnter,
  onLeave,
  onRun,
}: {
  submenu: RightClickSubmenu;
  anchorEl: HTMLElement;
  onEnter: () => void;
  onLeave: () => void;
  onRun: (handler: RightClickHandler) => void;
}) {
  return (
    // A non-modal Popper, not a Popover. A Popover brings a full-screen
    // invisible backdrop that swallows outside clicks and makes the
    // pointer never leave the submenu, so it stays open forever.
    // Popper only renders the surface itself, so leaving it fires
    // onMouseLeave and outside clicks reach the parent Menu backdrop.
    <Popper
      open
      anchorEl={anchorEl}
      placement="right-start"
      sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
    >
      <Paper
        elevation={12}
        sx={SURFACE_SX}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <MenuList>
          {submenu.items.map((item) => (
            <MenuItem
              key={item.id}
              disabled={item.disabled}
              onClick={() => onRun(item.handler)}
              sx={ITEM_TEXT_SX}
            >
              {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
              <ListItemText>{item.label}</ListItemText>
              <ShortcutHint shortcut={item.shortcut} />
            </MenuItem>
          ))}
        </MenuList>
      </Paper>
    </Popper>
  );
}

function Row({
  row,
  getHandler,
  onRun,
}: {
  row: ResolvedMenuRow;
  getHandler: (row: ResolvedMenuRow) => RightClickHandler | undefined;
  onRun: (handler: RightClickHandler) => void;
}) {
  const [openSubmenu, setOpenSubmenu] = useState(false);
  const [submenuAnchor, setSubmenuAnchor] = useState<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowNode = useRef<HTMLElement | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const hasSubmenu = Boolean(row.submenu);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
    // Set the anchor from the handler, not during render.
    setSubmenuAnchor(rowNode.current);
    setOpenSubmenu(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpenSubmenu(false);
      setSubmenuAnchor(null);
    }, SUBMENU_CLOSE_DELAY_MS);
  };

  const handleClick = () => {
    if (row.disabled) return;
    // Rows with a submenu open it on hover, so clicking must not fire.
    if (hasSubmenu) return;
    const handler = getHandler(row);
    if (handler) onRun(handler);
  };

  return (
    <>
      <MenuItem
        ref={(node: HTMLElement | null) => {
          rowNode.current = node;
        }}
        disabled={row.disabled}
        onClick={handleClick}
        onMouseEnter={hasSubmenu ? cancelClose : undefined}
        onMouseLeave={hasSubmenu ? scheduleClose : undefined}
        sx={ITEM_TEXT_SX}
      >
        <ListItemIcon>{row.icon ?? null}</ListItemIcon>
        <ListItemText>
          {row.kind === "custom" ? (row.node ?? row.label) : row.label}
        </ListItemText>
        <ShortcutHint shortcut={row.shortcut} />
        {/* Right chevron marks a row that opens a submenu. */}
        {hasSubmenu && (
          <ChevronRightIcon
            fontSize="small"
            sx={{ ml: 1, color: "text.disabled" }}
          />
        )}
      </MenuItem>
      {hasSubmenu && openSubmenu && submenuAnchor && row.submenu && (
        <SubmenuList
          submenu={row.submenu}
          anchorEl={submenuAnchor}
          onEnter={cancelClose}
          onLeave={scheduleClose}
          onRun={onRun}
        />
      )}
    </>
  );
}

export const RightClickMenu: React.FC<RightClickMenuProps> = ({
  anchorPosition,
  rows,
  getHandler,
  onRun,
  onClose,
}) => (
  <Menu
    open
    onClose={onClose}
    anchorReference="anchorPosition"
    anchorPosition={anchorPosition}
    slotProps={{ paper: { elevation: 12, sx: SURFACE_SX } }}
  >
    <MenuList autoFocusItem>
      {rows.map((row) =>
        row.kind === "divider" ? (
          <Divider key={row.key} />
        ) : (
          <Row
            key={row.key}
            row={row}
            getHandler={getHandler}
            onRun={onRun}
          />
        ),
      )}
    </MenuList>
  </Menu>
);
