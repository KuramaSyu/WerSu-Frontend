import {
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
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
    <UpperPanel spacing={1}>
      <Typography variant="h5" sx={{ mb: 1 }}>
        Settings
      </Typography>
      <Divider />
      <List disablePadding>
        {settingsCategories.map((category) => {
          const isActive = activeCategoryId === category.id;
          return (
            <ListItemButton
              key={category.id}
              selected={isActive}
              onClick={() => handleClick(category.id)}
            >
              {category.icon !== undefined && (
                <ListItemIcon>{category.icon}</ListItemIcon>
              )}
              <ListItemText primary={category.label} />
            </ListItemButton>
          );
        })}
      </List>
    </UpperPanel>
  );
};
