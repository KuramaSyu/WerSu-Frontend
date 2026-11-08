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
}

/**
 * Paper card used by the left rails.
 *
 * The rail canvas stays on `background.default`; the card body uses the
 * paper surface and only the heading row gets a light primary wash. This
 * keeps every side rail on the same visual hierarchy as the Home rail
 * while still supporting collapsible sections (metadata, outline).
 */
export const RailSection: React.FC<RailSectionProps> = ({
  title,
  description,
  icon,
  titleAction,
  children,
  collapsible = false,
  defaultExpanded = true,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const bodyVisible = !collapsible || expanded;
  const toggle = collapsible
    ? () => setExpanded((current) => !current)
    : undefined;

  return (
    <Paper
      component="section"
      variant="outlined"
      elevation={0}
      sx={{
        minWidth: 0,
        borderRadius: 2,
        borderColor: "divider",
        backgroundColor: "background.paper",
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
