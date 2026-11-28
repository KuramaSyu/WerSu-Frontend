import { useState, type ReactNode } from "react";
import {
  Box,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Typography,
  alpha,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { LEFT_PANEL_SECTION_ELEVATION } from "../../statics";
import { FeatureFlagName, useFeatureStore } from "../../zustand/FeatureStore";

export interface RailSectionProps {
  /** Section title. */
  title: string;
  /** Optional one-line summary under the title. */
  description?: string;
  /** Optional icon rendered in the tinted tile. */
  icon?: ReactNode;
  /** Optional control rendered before the collapse toggle. */
  titleAction?: ReactNode;
  /** Section body. */
  children: ReactNode;
  /** Allow collapsing the body via the header. Defaults to false. */
  collapsible?: boolean;
  /** Initial expanded state when collapsible. Defaults to true. */
  defaultExpanded?: boolean;
  /**
   * MUI elevation of the card surface. Drives the body fill: in dark mode
   * every step up adds MUI's `Paper` white overlay (and a matching shadow),
   * so this is the single knob for how light the section body reads.
   * Defaults to `LEFT_PANEL_SECTION_ELEVATION` (1) to match the editor
   * card; pass 0 for a flat, outlined-style card with no overlay.
   */
  elevation?: number;
}

/**
 * Paper card used by the left rails.
 *
 * The rail canvas stays on `background.default`; the card body is a
 * `variant="elevation"` Paper, so its fill is `background.default` (or
 * `background.paper` when FlatLayout is off) plus the elevation overlay MUI
 * applies in dark mode — the same base + overlay composite the note editor
 * card uses. The heading row keeps its light primary wash on top of that
 * body, so the header still reads as tinted without owning a color of its
 * own.
 *
 * At `elevation={0}` there is no overlay, so the card falls back to a
 * divider border to keep its edge visible. The default comes from
 * `LEFT_PANEL_SECTION_ELEVATION` in `statics.tsx` so it can be tuned next
 * to the rail / main-panel elevations.
 */
export const RailSection: React.FC<RailSectionProps> = ({
  title,
  description,
  icon,
  titleAction,
  children,
  collapsible = false,
  defaultExpanded = true,
  elevation = LEFT_PANEL_SECTION_ELEVATION,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const flatLayout = useFeatureStore(
    (state) => state.flags[FeatureFlagName.FlatLayout],
  );
  const bodyVisible = !collapsible || expanded;
  const toggle = collapsible
    ? () => setExpanded((current) => !current)
    : undefined;

  return (
    <Paper
      component="section"
      variant="elevation"
      elevation={elevation}
      sx={{
        minWidth: 0,
        borderRadius: 2,
        // The body fill is the Paper default (`background.paper` + the
        // dark-mode elevation overlay); only the flat variant needs an
        // explicit outline, since elevation supplies its own edge shadow.
        border: elevation === 0 ? "1px solid" : "none",
        borderColor: "divider",
        // Match the note editor's base: FlatLayout paints the shell/flat
        // canvas tone, otherwise the paper tone. The elevation overlay
        // above it is what actually differentiates the card from its rail.
        backgroundColor: flatLayout ? "background.default" : "background.paper",
        overflow: "hidden",
      }}
    >
      <Box
        onClick={toggle}
        sx={{
          px: 1.5,
          py: 1.25,
          cursor: collapsible ? "pointer" : "default",
          borderBottom: bodyVisible ? "1px solid" : 0,
          borderColor: "divider",
          backgroundColor: (theme) =>
            alpha(
              theme.palette.primary.main,
              theme.palette.mode === "dark" ? 0.06 : 0.04,
            ),
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          {icon !== undefined && (
            <Box
              aria-hidden
              sx={{
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                width: 36,
                height: 36,
                borderRadius: 1.5,
                color: "primary.main",
                backgroundColor: (theme) =>
                  alpha(
                    theme.palette.primary.main,
                    theme.palette.mode === "dark" ? 0.16 : 0.1,
                  ),
                "& svg": { fontSize: 22 },
              }}
            >
              {icon}
            </Box>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              component="h3"
              variant="subtitle1"
              sx={{ fontWeight: 600, lineHeight: 1.35 }}
            >
              {title}
            </Typography>
            {description !== undefined && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", lineHeight: 1.45 }}
              >
                {description}
              </Typography>
            )}
          </Box>
          {titleAction !== undefined && (
            <Box sx={{ flexShrink: 0 }}>{titleAction}</Box>
          )}
          {collapsible && (
            <IconButton
              size="small"
              aria-label={`${expanded ? "Collapse" : "Expand"} ${title}`}
              aria-expanded={expanded}
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((current) => !current);
              }}
              sx={{ flexShrink: 0 }}
            >
              <ExpandMoreIcon
                fontSize="small"
                sx={{
                  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                  transition: (theme) =>
                    theme.transitions.create("transform", {
                      duration: theme.transitions.duration.shortest,
                    }),
                }}
              />
            </IconButton>
          )}
        </Stack>
      </Box>
      {collapsible ? (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box sx={{ px: 1.5, py: 1 }}>{children}</Box>
        </Collapse>
      ) : (
        <Box sx={{ px: 1.5, py: 1 }}>{children}</Box>
      )}
    </Paper>
  );
};
