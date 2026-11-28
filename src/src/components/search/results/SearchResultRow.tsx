import React, { memo, useCallback, useMemo } from "react";
import {
  Box,
  Divider,
  Paper,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import { useThemeStore } from "../../../zustand/useThemeStore";
import { M2, M3 } from "../../../statics";
import { NoteVisibilityScope } from "../../../api/models/noteVisibility";
import { copyToClipboard } from "../../../zustand/InfoStore";
import { useRightClickMenu } from "../../RightClick/useRightClickMenu";
import { useVisibilityHideMenu } from "../../RightClick/visibilityHideMenu";
import { VisibilityHideIcon } from "../../RightClick/VisibilityHideIcon";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import type { SearchResult, SearchResultContent } from "./SearchResult";

interface Props {
  result: SearchResult;
  index: number;
  isSelected: boolean;
  hoverEnabled: boolean;
  onSelect: (index: number) => void;
  onActivate: (result: SearchResult) => void;
}

// Interleave dividers between snippets. Side by side they read as separate
// columns in a horizontal strip; when stacked (mobile) they become rows.
const withDividers = (
  items: React.ReactNode[],
  stacked: boolean,
): React.ReactNode => (
  <>
    {items.map((item, i) => (
      <React.Fragment key={i}>
        {i > 0 ? (
          <Divider orientation={stacked ? "horizontal" : "vertical"} flexItem />
        ) : null}
        {item}
      </React.Fragment>
    ))}
  </>
);

// Render the interface's content value: strings / string[] become text,
// anything else (note highlight fragments, custom nodes) is dropped in.
const renderContent = (
  content: SearchResultContent,
  stacked: boolean,
): React.ReactNode => {
  if (typeof content === "string") {
    return <Typography variant="body2">{content}</Typography>;
  }
  if (Array.isArray(content)) {
    if (content.length > 0 && content.every((item) => typeof item === "string")) {
      return withDividers(
        content.map((line, i) => (
          <Typography key={`line-${i}`} variant="body2">
            {line}
          </Typography>
        )),
        stacked,
      );
    }
    return withDividers(content as React.ReactNode[], stacked);
  }
  return <>{content}</>;
};

// single result row; memoized so arrow-key navigation doesn't remount
// the neighbouring rows. Renders only through the `SearchResult`
// interface, so every result kind shares this layout.
export const SearchResultRow: React.FC<Props> = memo(
  ({ result, index, isSelected, hoverEnabled, onSelect, onActivate }) => {
    const theme = useThemeStore((s) => s.theme);
    const { isMobile } = useBreakpoint();
    const content = renderContent(result.get_content(), isMobile);
    const meta = result.get_meta?.();
    const accent = result.get_accent_color();
    const menu = useRightClickMenu();
    const { buildSubmenu, dialog } = useVisibilityHideMenu(
      NoteVisibilityScope.SEARCH,
    );

    const noteId = result.get_note_id?.();
    const directoryId = result.get_directory_id?.();
    const hideTarget = useMemo(
      () =>
        noteId
          ? ({ kind: "note", id: noteId } as const)
          : directoryId
            ? ({ kind: "directory", id: directoryId } as const)
            : undefined,
      [noteId, directoryId],
    );

    const onContextMenu = useCallback(
      (event: React.MouseEvent) => {
        menu.onContextMenu(event, {
          targetId: result.get_id(),
          buttons: ["copy"],
          overrides: {
            copy: {
              handler: () => {
                void copyToClipboard(result.get_copy_text?.() ?? result.get_id());
                return true;
              },
            },
          },
          ...(hideTarget
            ? {
                extraComponents: [
                  {
                    key: "hide-from-search",
                    label: "Hide",
                    icon: <VisibilityHideIcon />,
                    submenu: buildSubmenu(hideTarget),
                  },
                ],
              }
            : {}),
        });
      },
      [menu, result, hideTarget, buildSubmenu],
    );

    return (
      <Box sx={{ display: "contents" }} onContextMenu={onContextMenu}>
      <Paper
        data-search-index={index}
        elevation={isSelected ? 1 : 0}
        onMouseEnter={() => {
          if (hoverEnabled) onSelect(index);
        }}
        onClick={() => onActivate(result)}
        sx={{
          border: "1px solid",
          borderColor: theme.palette.divider,
          borderLeft: `3px solid ${alpha(
            accent,
            isSelected ? 0.75 : 0.4,
          )}`,
          backgroundColor: theme.palette.background.paper,
          cursor: "pointer",
          transition: theme.transitions.create(
            ["background-color", "border-color", "transform"],
            { duration: theme.transitions.duration.short },
          ),
          transform: isSelected ? "translateX(6px)" : "none",
          display: "flex",
          flexDirection: "row",
          overflow: "hidden",
        }}
      >
        {/* Kind strip: sits against the accent border and spans the full row
            height, tinted with the accent so it reads as a lighter panel. */}
        <Tooltip title={result.get_type_label()} placement="top" arrow>
          <Box
            aria-label={result.get_type_label()}
            sx={{
              flexShrink: 0,
              width: 40,
              alignSelf: "stretch",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: alpha(accent, isSelected ? 0.08 : 0.04),
              color: theme.palette.text.secondary,
              boxShadow: `inset -1px 0 0 ${alpha(
                theme.palette.divider,
                0.5,
              )}`,
            }}
          >
            {result.get_type_icon()}
          </Box>
        </Tooltip>

        {/* Actual content, kept on the row's elevated paper surface. On
            mobile the header and snippets stack vertically; on wider
            screens they sit side by side. */}
        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: M2,
            p: M2,
            pl: M3,
            flex: 1,
            minWidth: 0,
          }}
        >
          <Box
            className="note.header"
            sx={{ minWidth: isMobile ? 0 : 3 / 8 }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                lineHeight: 1.35,
                mb: M2,
                color: theme.palette.text.primary,
              }}
            >
              {result.get_title()}
            </Typography>

            {meta ? (
              <Stack
                direction="row"
                spacing={2}
                sx={{ minWidth: isMobile ? 0 : 5 / 8, flexWrap: "wrap" }}
              >
                {meta}
              </Stack>
            ) : null}
          </Box>

          <Divider
            orientation={isMobile ? "horizontal" : "vertical"}
            flexItem
          />
          {/* Mobile stacks the matched snippets below the title; wider
              screens keep them side by side in a horizontal strip. */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              gap: M2,
              overflow: "hidden",
            }}
          >
            {content}
          </Box>
        </Box>
      </Paper>
      {hideTarget ? dialog : null}
      </Box>
    );
  },
);

SearchResultRow.displayName = "SearchResultRow";

export default SearchResultRow;
