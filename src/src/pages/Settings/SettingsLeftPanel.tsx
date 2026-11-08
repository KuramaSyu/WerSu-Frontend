import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
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
      <Paper
        elevation={0}
        sx={{
          borderRadius: 2,
          overflow: "hidden",
          backgroundColor: "background.default",
        }}
      >
        <Box
          sx={{
            px: 2.5,
            py: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography
            variant="h5"
            sx={{ fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.3 }}
          >
            Settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            App preferences &amp; tools
          </Typography>
        </Box>
        <List disablePadding sx={{ p: 1 }}>
          {settingsCategories.map((category) => {
            const isActive = activeCategoryId === category.id;
            return (
              <ListItemButton
                key={category.id}
                selected={isActive}
                onClick={() => handleClick(category.id)}
                sx={{
                  borderRadius: 1.5,
                  mb: 0.5,
                  "&:last-of-type": { mb: 0 },
                }}
              >
                {category.icon !== undefined && (
                  <ListItemIcon
                    sx={{ minWidth: 40, color: isActive ? "primary.main" : "inherit" }}
                  >
                    {category.icon}
                  </ListItemIcon>
                )}
                <ListItemText
                  primary={category.label}
                  slotProps={{
                    primary: {
                      variant: "body2",
                      sx: { fontWeight: isActive ? 600 : 500 },
                    },
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Paper>
    </UpperPanel>
  );
};
