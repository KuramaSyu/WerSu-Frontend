import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { ThemeProvider, useTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useMemo, useState } from "react";
import { M1, M2, M3 } from "../../statics";
import { useThemeStore } from "../../zustand/useThemeStore";

export interface PanelSectionProps {
  /** Optional title shown above the section body. */
  title?: string;
  /** Optional icon rendered to the left of the title. */
  titleIcon?: React.ReactNode;
  /** Optional content rendered to the right of the title (e.g. action buttons). */
  titleAction?: React.ReactNode;
  /** Body content. */
  children?: React.ReactNode;
  /** Spacing multiplier between items. Defaults to 2. */
  spacing?: number;
  /** Opacity for the divider. Defaults to 0.8. */
  dividerOpacity?: number;
  /** Show a divider between title and body. Defaults to true when a title is present. */
  showDivider?: boolean;
  /** Allow collapsing the body via the title row. Defaults to false. */
  collapsible?: boolean;
  /** Initial expanded state when `collapsible`. Defaults to true. */
  defaultExpanded?: boolean;
  /**
   * Wrap the section in a thin outlined card with no fill, so the page
   * background shows through. Used by the right rail, where each section
   * reads as its own bordered block rather than part of one big shell.
   * Defaults to false.
   */
  bordered?: boolean;
  /**
   * Optional control rendered on the section's left border, vertically
   * centred. Used by the right rail to host the panel collapse handle on
   * the first section.
   */
  leftEdgeHandle?: React.ReactNode;
}

interface PanelSectionTitleProps {
  /** Title text rendered above the section body. */
  title?: string;
  /** Optional icon rendered to the left of the title. */
  titleIcon?: React.ReactNode;
  /** Optional content rendered to the right of the title (e.g. action buttons). */
  titleAction?: React.ReactNode;
  /** Whether this title is rendered inside an Accordion summary. */
  inAccordion: boolean;
}

/**
 * Title row used by `PanelSection`.
 *
 * Renders an optional icon, the title text, and an optional action slot.
 * The title color lightens/darkens on hover to mirror the section body's
 * hover treatment.
 */
const PanelSectionTitle: React.FC<PanelSectionTitleProps> = ({
  title,
  titleIcon,
  titleAction,
  inAccordion,
}) => {
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);
  // `iconTransition` is a static snippet per theme (doesn't change on
  // hover), so reading it from the global store is fine.
  const iconTransition = useThemeStore((s) => s.theme.iconTransition);

  // dim function which dimms given color
  // const dim = (color: string) =>
  //   theme.palette.mode === "dark"
  //     ? theme.darken(color, 0.3)
  //     : theme.lighten(color, 0.3);

  // const dimmedTextColor = useMemo(
  //   () => dim(theme.palette.text.primary),
  //   [theme],
  // );

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        mb: inAccordion ? 0 : M1,
        minHeight: 24,
        width: "100%",
        color: theme.palette.text.secondary,
        ...iconTransition.root,
      }}
    >
      {titleIcon !== undefined && (
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            px: M1,
            color: theme.palette.text.secondary,
            ...iconTransition.root,
          }}
        >
          {titleIcon}
        </Box>
      )}
      <Typography
        variant="body1"
        sx={{
          textTransform: "uppercase",
          ...iconTransition.root,
          zindex: 10,
        }}
      >
        {title}
      </Typography>
      <Box sx={{ ml: "auto", display: "flex", alignItems: "center" }}>
        {titleAction}
      </Box>
    </Box>
  );
};

/**
 * A consistent section block used inside side panels.
 *
 * Renders a title (optional), a divider, and a stacked body. Intended for
 * stacking alongside other `PanelSection`s so each section reads as its
 * own block. When `collapsible` is set, the title row toggles the body via
 * a borderless `Accordion`.
 */
export const PanelSection: React.FC<PanelSectionProps> = ({
  title,
  titleIcon,
  titleAction,
  children,
  spacing = 2,
  dividerOpacity = 0.8,
  showDivider,
  collapsible = false,
  defaultExpanded = true,
  bordered = false,
  leftEdgeHandle,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [hovered, setHovered] = useState(false);
  const renderDivider = showDivider ?? title !== undefined;

  const theme = useTheme();

  // Thin, transparent outline for the `bordered` card. Padding keeps the
  // title / body from pressing against the border.
  const frameSx = bordered
    ? {
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: `${theme.shape.borderRadius}px`,
        backgroundColor: "transparent",
        p: M1,
      }
    : undefined;

  // dim function which dimms given color
  const dim = (color: string) =>
    theme.palette.mode === "dark"
      ? theme.darken(color, 0.3)
      : theme.lighten(color, 0.3);

  // dimmed theme for not hovered state
  const dimmedTheme = useMemo(
    () => ({
      ...theme,
      palette: {
        ...theme.palette,
        text: {
          ...theme.palette.text,
          primary: dim(theme.palette.text.primary),
          secondary: dim(theme.palette.text.secondary),
          disabled: dim(theme.palette.text.disabled),
        },
      },
    }),
    [theme],
  );
  const activeTheme = hovered ? theme : dimmedTheme;

  const hoverHandlers = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  const body = <Stack spacing={spacing}>{children}</Stack>;

  // No title -> just the body. The divider still renders if the caller
  // explicitly asked for one (e.g. with `showDivider`).
  if (title === undefined) {
    return (
      <ThemeProvider theme={activeTheme}>
        <Box
          {...hoverHandlers}
          sx={{ position: "relative", ...frameSx }}
        >
          {leftEdgeHandle}
          {renderDivider && (
            <Divider sx={{ opacity: dividerOpacity, mb: 1.5 }} />
          )}
          {body}
        </Box>
      </ThemeProvider>
    );
  }

  // Collapsible title -> borderless Accordion wrapping the shared title
  // row plus the body.
  if (collapsible) {
    return (
      <ThemeProvider theme={activeTheme}>
        <Accordion
          {...hoverHandlers}
          expanded={expanded}
          onChange={(_, isExpanded) => setExpanded(isExpanded)}
          disableGutters
          elevation={0}
          square
          sx={{
            position: "relative",
            ...frameSx,
            zindex: 10,
            // adjust accordion paddings to
            // spare a lot of otherwise wasted space
            // in a side rail
            backgroundColor: "transparent",
            "&:before": { display: "none" },
            "&.MuiAccordion-root": {
              margin: 0,
            },
            "& .MuiAccordionSummary-root": {
              minHeight: 32,
              px: 0,
              "&:hover": {
                backgroundColor: "action.hover",
              },
              "&.Mui-expanded": {
                minHeight: 32,
              },
              "& .MuiAccordionSummary-content": {
                my: 0,
                "&.Mui-expanded": {
                  my: 0,
                },
              },
            },
            "& .MuiAccordionDetails-root": {
              px: 0,
              py: 1,
            },
          }}
        >
          {leftEdgeHandle}
          <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
            <PanelSectionTitle
              inAccordion
              title={title}
              titleIcon={titleIcon}
              titleAction={titleAction}
            />
          </AccordionSummary>
          {renderDivider && <Divider sx={{ opacity: dividerOpacity }} />}
          <AccordionDetails>
            <Box sx={{ px: M3 }}>{body}</Box>
          </AccordionDetails>
        </Accordion>
      </ThemeProvider>
    );
  }

  // Plain (non-collapsible) title -> shared title row + optional divider + body.
  return (
    // px used to allign with padding of accordion
    <ThemeProvider theme={activeTheme}>
      <Box {...hoverHandlers} sx={{ position: "relative", ...frameSx, px: M2 }}>
        {leftEdgeHandle}
        <PanelSectionTitle
          inAccordion={false}
          title={title}
          titleIcon={titleIcon}
          titleAction={titleAction}
        />
        {children && (
          <>
            {renderDivider && (
              <Divider sx={{ opacity: dividerOpacity, mb: 1.5 }} />
            )}
            {body}
          </>
        )}
      </Box>
    </ThemeProvider>
  );
};
