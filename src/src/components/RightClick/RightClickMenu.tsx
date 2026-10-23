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
  Popover,
  Typography,
} from "@mui/material";
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

export interface RightClickMenuProps {
  anchorEl: HTMLElement | null;
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
    <Typography variant="body2" color="text.secondary" component="span">
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
    <Popover
      open
      anchorEl={anchorEl}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      disableRestoreFocus
      slotProps={{ paper: { sx: { mt: 0.5 } } }}
    >
      <Paper>
        <MenuList autoFocusItem>
          {submenu.items.map((item) => (
            <MenuItem
              key={item.id}
              disabled={item.disabled}
              onClick={() => onRun(item.handler)}
            >
              {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
              <ListItemText>{item.label}</ListItemText>
              <ShortcutHint shortcut={item.shortcut} />
            </MenuItem>
          ))}
        </MenuList>
      </Paper>
    </Popover>
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

  const hasSubmenu = row.kind === "button" && Boolean(row.submenu);

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
      >
        <ListItemIcon>
          {row.icon ??
            (hasSubmenu ? <ChevronRightIcon fontSize="small" /> : null)}
        </ListItemIcon>
        <ListItemText>
          {row.kind === "custom" ? (row.node ?? row.label) : row.label}
        </ListItemText>
        <ShortcutHint shortcut={row.shortcut} />
      </MenuItem>
      {hasSubmenu &&
        openSubmenu &&
        submenuAnchor &&
        row.kind === "button" &&
        row.submenu && (
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
  anchorEl,
  rows,
  getHandler,
  onRun,
  onClose,
}) => (
  <Menu anchorEl={anchorEl} open onClose={onClose}>
    <Paper>
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
    </Paper>
  </Menu>
);
