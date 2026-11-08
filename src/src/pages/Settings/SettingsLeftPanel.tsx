import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  alpha,
} from "@mui/material";
import { useSettingsNavStore } from "./SettingsStore";
import { settingsCategories } from "./categories";
import { UpperPanel } from "../../components/Panels/UpperPanel";

/**
 * Content for the left side panel on the Settings page.
 *
 * Renders a sticky list of categories synced with the body's
 * active-section highlight (read from `useSettingsNavStore`) and
 * scrolls to the matching section when a row is clicked.
 *
 * Mounted by `Main` via `useLeftPanel()` so the rail lives in the
 * layout's side panel slot rather than next to the body in JSX —
 * this matches how other routed pages (Home, DirectoryView, etc.)
 * share layout state.
 *
 * The rail deliberately paints `background.default` so it reads as part
 * of the canvas. Hierarchy comes from the header type scale, the active
 * row's accent bar, and the icon/label treatment instead of a card
 * surface.
 */
export const SettingsLeftPanel: React.FC = () => {
  const activeCategoryId = useSettingsNavStore((s) => s.activeCategoryId);

  const handleClick = (id: string) => {
    // Belt-and-braces: stop in-view updates from racing the manual
    // scroll and overwriting the active id mid-flight.
    useSettingsNavStore.getState().setActiveCategoryId(id);
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <UpperPanel>
      <Box
        component="nav"
        aria-label="Settings categories"
        sx={{
          backgroundColor: "background.default",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            px: 2.5,
            pt: 2.5,
            pb: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography
            variant="overline"
            color="primary.main"
            sx={{ fontWeight: 700, letterSpacing: "0.12em" }}
          >
            Configuration
          </Typography>
          <Typography
            variant="h5"
            sx={{
              mt: 0.25,
              fontSize: "1.35rem",
              fontWeight: 600,
              lineHeight: 1.25,
            }}
          >
            Settings
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, lineHeight: 1.45 }}
          >
            App preferences, integrations and account tools.
          </Typography>
        </Box>

        <List disablePadding sx={{ px: 1.5, py: 2 }}>
          {settingsCategories.map((category) => {
            const isActive = activeCategoryId === category.id;
            return (
              <ListItemButton
                key={category.id}
                selected={isActive}
                onClick={() => handleClick(category.id)}
                sx={{
                  position: "relative",
                  minHeight: 48,
                  px: 1.25,
                  py: 1,
                  mb: 0.5,
                  borderRadius: 1.5,
                  "&:last-of-type": { mb: 0 },
                  "&.Mui-selected": {
                    backgroundColor: (theme) =>
                      alpha(
                        theme.palette.primary.main,
                        theme.palette.mode === "dark" ? 0.14 : 0.09,
                      ),
                    "&:hover": {
                      backgroundColor: (theme) =>
                        alpha(
                          theme.palette.primary.main,
                          theme.palette.mode === "dark" ? 0.2 : 0.14,
                        ),
                    },
                  },
                  "&:hover": { backgroundColor: "action.hover" },
                  // Left accent rail on the active row. Kept as a pseudo
                  // element so the row keeps the same padding in every state.
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    left: 0,
                    top: 10,
                    bottom: 10,
                    width: 3,
                    borderRadius: "0 3px 3px 0",
                    backgroundColor: "primary.main",
                    opacity: isActive ? 1 : 0,
                    transition: (theme) =>
                      theme.transitions.create("opacity", {
                        duration: theme.transitions.duration.shortest,
                      }),
                  },
                }}
              >
                {category.icon !== undefined && (
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      color: isActive ? "primary.main" : "text.secondary",
                      "& svg": { fontSize: 20 },
                    }}
                  >
                    {category.icon}
                  </ListItemIcon>
                )}
                <ListItemText
                  primary={category.label}
                  slotProps={{
                    primary: {
                      variant: "body2",
                      sx: {
                        fontSize: "0.9rem",
                        fontWeight: isActive ? 600 : 500,
                        letterSpacing: "0.01em",
                      },
                    },
                  }}
                />
                <Box
                  aria-hidden
                  sx={{
                    width: 6,
                    height: 6,
                    flexShrink: 0,
                    ml: 1,
                    borderRadius: "50%",
                    backgroundColor: "primary.main",
                    opacity: isActive ? 1 : 0,
                    transition: (theme) =>
                      theme.transitions.create("opacity", {
                        duration: theme.transitions.duration.shortest,
                      }),
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Box>
    </UpperPanel>
  );
};
