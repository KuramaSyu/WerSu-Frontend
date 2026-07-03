import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useState } from "react";
import { M1, M2, M3, M4 } from "../../statics";
import { useThemeStore } from "../../zustand/useThemeStore";

export interface PanelSectionProps {
  /** Optional title shown above the section body. */
  title?: string;
  /** Optional icon rendered to the left of the title. */
  titleIcon?: React.ReactNode;
  /** Body content. */
  children: React.ReactNode;
  /** Spacing multiplier between items. Defaults to 2. */
  spacing?: number;
  /** Opacity for the divider. Defaults to 0.3 to match existing usages. */
  dividerOpacity?: number;
  /** Show a divider between title and body. Defaults to true when a title is present. */
  showDivider?: boolean;
  /** Allow collapsing the body via the title row. Defaults to false. */
  collapsible?: boolean;
  /** Initial expanded state when `collapsible`. Defaults to true. */
  defaultExpanded?: boolean;
}

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
  children,
  spacing = 2,
  dividerOpacity = 0.3,
  showDivider,
  collapsible = false,
  defaultExpanded = true,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const renderDivider = showDivider ?? title !== undefined;
  const { theme } = useThemeStore();

  const body = <Stack spacing={spacing}>{children}</Stack>;

  if (!collapsible || title === undefined) {
    return (
      <Box>
        {title !== undefined && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: M1,
              minHeight: 24,
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
                }}
              >
                {titleIcon}
              </Box>
            )}
            <Typography variant="subtitle2" color="textSecondary">
              {title}
            </Typography>
          </Box>
        )}
        {renderDivider && <Divider sx={{ opacity: dividerOpacity, mb: 1.5 }} />}
        {body}
      </Box>
    );
  }

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
      disableGutters
      elevation={0}
      square
      sx={{
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
      <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            minHeight: 24,
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
                py: M3,
              }}
            >
              {titleIcon}
            </Box>
          )}
          <Typography
            variant="subtitle2"
            color="textSecondary"
            sx={{ textTransform: "uppercase" }}
          >
            {title}
          </Typography>
        </Box>
      </AccordionSummary>
      {renderDivider && <Divider sx={{ opacity: dividerOpacity }} />}
      <AccordionDetails>
        <Box sx={{ px: M3, color: theme.palette.text.secondary }}>{body}</Box>
      </AccordionDetails>
    </Accordion>
  );
};
