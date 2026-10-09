import { Box, Stack, Tooltip, Typography, useTheme } from "@mui/material";
import { useThemeStore } from "../../zustand/useThemeStore";
import React from "react";

/** Props for IconTitleSubtitleRow.
 *  Slot-only layout: caller passes icon / title / subtitle; positions stay consistent across every panel. */
export interface IconTitleSubtitleRowProps {
  /** Variant-driven icon rendered to the left of the text block.
   *  Omit (or null) to skip the icon column entirely so icon-less panels sit flush against padding. */
  icon?: React.ReactNode;
  /** Required main title line. */
  title: React.ReactNode;
  /** Optional secondary line under the title (descriptions / timestamps). */
  subtitle?: React.ReactNode;
  /** Optional click handler; when set, the row behaves as a button. */
  onClick?: () => void;
  /** Tooltip wrapping the icon; doubles as a developerMode debug surface (pass stringified entry). */
  iconTooltip?: React.ReactNode;
  /** Overlay a tooltip on the row that dumps the raw entry. Caller wires up developerMode; row stays store-free. */
  developerDebug?: React.ReactNode;
  /** Override the clickable area. Defaults to true when onClick is set; pass false to render non-interactive. */
  interactive?: boolean;
}

/** Single row: optional icon (with tooltip) + title + subtitle.
 *  When icon is provided, a Tooltip wraps a small Box (20px column).
 *  When icon is null, the column collapses so icon-less panels sit at the natural padding edge. */
export const IconTitleSubtitleRow: React.FC<IconTitleSubtitleRowProps> = ({
  icon,
  title,
  subtitle,
  onClick,
  iconTooltip,
  developerDebug,
  interactive,
}) => {
  const { theme: storeTheme } = useThemeStore();
  // useTheme() picks up the nearest ThemeProvider (PanelSection sets a dimmed theme on not-hover).
  const theme = useTheme();
  const isInteractive = interactive ?? onClick !== undefined;

  const body = (
    <Stack
      direction="row"
      spacing={theme.spacing(1)}
      sx={{
        alignItems: "flex-start",
        cursor: isInteractive ? "pointer" : "default",
        borderRadius: 1,
        px: 1,
        py: 0.5,
        transition: theme.transitions.create(
          ["background-color", "transform"],
          { duration: theme.transitions.duration.short },
        ),
        "&:hover": isInteractive
          ? { backgroundColor: theme.palette.action.hover }
          : undefined,
      }}
      onClick={onClick}
    >
      {icon !== undefined && icon !== null && (
        <Tooltip title={iconTooltip ?? ""} placement="right">
          <Box
            sx={{
              pt: 0.25,
              display: "flex",
              alignItems: "center",
              color: storeTheme.palette.text.secondary,
            }}
          >
            {icon}
          </Box>
        </Tooltip>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }} aria-label={"Creation time"}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {title}
        </Typography>
        {subtitle && (
          <Typography
            variant="caption"
            color="textSecondary"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
    </Stack>
  );

  return developerDebug ? (
    <Tooltip title={developerDebug} placement="right">
      {body}
    </Tooltip>
  ) : (
    body
  );
};

/** Props for HistoryListPanel.
 *  Caller supplies rows / isLoading / hasError, three messaging strings, and a renderRow callback. */
export interface HistoryListPanelProps {
  /** Row data; pass the resolved entries from your data hook. */
  rows: ReadonlyArray<unknown>;
  /** Render a single entry as a row. Caller owns icon / title / subtitle. */
  renderRow: (row: unknown, index: number) => React.ReactNode;
  /** Loading flag from the data hook. */
  isLoading: boolean;
  /** Error flag from the data hook. */
  hasError: boolean;
  /** Caption shown while isLoading. */
  loadingText: string;
  /** Caption shown when hasError and not loading. */
  errorText: string;
  /** Caption shown when there are no rows and we are not loading / errored. */
  emptyText: string;
  /** Optional panel title. Pass null to suppress the title bar. */
  title?: string | null;
  /** Vertical spacing multiplier between rows. Defaults to 1. */
  spacing?: number;
}

/** Generic stacked-history panel. Optional title, three messaging states, stack of caller rows.
 *  Container color reads from active theme's text.secondary so it dims with the surrounding PanelSection on not-hover. */
export const HistoryListPanel: React.FC<HistoryListPanelProps> = ({
  rows,
  renderRow,
  isLoading,
  hasError,
  loadingText,
  errorText,
  emptyText,
  title,
  spacing = 1,
}) => {
  const theme = useTheme();

  return (
    <Box sx={{ color: theme.palette.text.secondary }}>
      {title !== null && title !== undefined && (
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, mb: theme.spacing(1) }}
        >
          {title}
        </Typography>
      )}
      {isLoading && (
        <Typography variant="body2" color="textSecondary">
          {loadingText}
        </Typography>
      )}
      {hasError && !isLoading && (
        <Typography variant="body2" color="error">
          {errorText}
        </Typography>
      )}
      {!isLoading && !hasError && rows.length === 0 && (
        <Typography variant="body2" color="textSecondary">
          {emptyText}
        </Typography>
      )}
      <Stack spacing={spacing}>
        {rows.map((row, index) => (
          <React.Fragment key={index}>{renderRow(row, index)}</React.Fragment>
        ))}
      </Stack>
    </Box>
  );
};
