import React, { memo } from "react";
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
import type { SearchResult, SearchResultContent } from "./SearchResult";

interface Props {
  result: SearchResult;
  index: number;
  isSelected: boolean;
  hoverEnabled: boolean;
  onSelect: (index: number) => void;
  onActivate: (result: SearchResult) => void;
}

// Interleave vertical dividers between snippets so multiple matches read as
// separate columns in the horizontal content strip.
const withDividers = (items: React.ReactNode[]): React.ReactNode => (
  <>
    {items.map((item, i) => (
      <React.Fragment key={i}>
        {i > 0 ? <Divider orientation="vertical" flexItem /> : null}
        {item}
      </React.Fragment>
    ))}
  </>
);

// Render the interface's content value: strings / string[] become text,
// anything else (note highlight fragments, custom nodes) is dropped in.
const renderContent = (content: SearchResultContent): React.ReactNode => {
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
      );
    }
    return withDividers(content as React.ReactNode[]);
  }
  return <>{content}</>;
};

// single result row; memoized so arrow-key navigation doesn't remount
// the neighbouring rows. Renders only through the `SearchResult`
// interface, so every result kind shares this layout.
export const SearchResultRow: React.FC<Props> = memo(
  ({ result, index, isSelected, hoverEnabled, onSelect, onActivate }) => {
    const theme = useThemeStore((s) => s.theme);
    const content = renderContent(result.get_content());
    const meta = result.get_meta?.();
    const accent = result.get_accent_color();

    return (
      <Paper
        data-search-index={index}
        elevation={isSelected ? 5 : 1}
        onMouseEnter={() => {
          if (hoverEnabled) onSelect(index);
        }}
        onClick={() => onActivate(result)}
        sx={{
          borderLeft: `5px solid ${accent}`,
          cursor: "pointer",
          transition: "all 0.2s ease",
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
              width: 44,
              alignSelf: "stretch",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: alpha(accent, 0.12),
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

        {/* Actual content, kept on the row's elevated paper surface. */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            gap: M2,
            p: M2,
            pl: M3,
            flex: 1,
            minWidth: 0,
          }}
        >
          <Box className="note.header" sx={{ minWidth: 3 / 8 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: "bold",
                mb: M2,
                color: theme.palette.text.primary,
              }}
            >
              {result.get_title()}
            </Typography>

            {meta ? (
              <Stack direction="row" spacing={2} sx={{ minWidth: 5 / 8 }}>
                {meta}
              </Stack>
            ) : null}
          </Box>

          <Divider orientation="vertical" flexItem />
          {/* Keep multiple matched snippets side by side, matching the
              original row layout instead of stacking them vertically. */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "row",
              gap: M2,
              overflow: "hidden",
            }}
          >
            {content}
          </Box>
        </Box>
      </Paper>
    );
  },
);

SearchResultRow.displayName = "SearchResultRow";

export default SearchResultRow;
