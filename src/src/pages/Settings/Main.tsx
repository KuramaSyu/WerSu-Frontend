import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useLeftPanel, usePanelSize } from "../../LayoutProvider";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { SettingsLeftPanel } from "./SettingsLeftPanel";
import { SettingsSection } from "./SettingsSection";
import { settingsCategories } from "./categories";
import { useSettingsNavStore } from "./SettingsStore";

/**
 * Settings page.
 *
 * Layout:
 *   - Desktop (md+): left rail in `useLeftPanel()` with the category
 *     list (highlighted via `useSettingsNavStore.activeCategoryId`),
 *     right body shows every category stacked as anchorable sections.
 *     An `IntersectionObserver` in the body writes the most-visible
 *     section id back to the store so the rail stays in sync.
 *   - Mobile (<md): the rail is collapsed by the layout; the body
 *     drill-ins: a category list first, then a single section with a
 *     back button. This mirrors the GoToHell two-pane / drill-in
 *     pattern that's come to define the Settings UX in this app.
 */
const SettingsPage: React.FC = () => {
  const { isMobile } = useBreakpoint();
  const setActiveCategoryId = useSettingsNavStore((s) => s.setActiveCategoryId);

  // Initialize the active id to the first category so the rail has a
  // highlighted row on first paint, before the observer runs.
  useEffect(() => {
    const firstId = settingsCategories[0]?.id ?? null;
    if (firstId !== null) {
      setActiveCategoryId(firstId);
    }
  }, [setActiveCategoryId]);

  // Mount the left rail in the layout's side-panel slot (per the
  // task brief: the left side panel lives in `useLeftPanel()`, not
  // inside this component's JSX).
  useLeftPanel(<SettingsLeftPanel />);
  usePanelSize({ left: "clamp(15rem, 20vw, 22rem)" });

  // Mobile drill-in state. `null` -> show the category list; a real
  // id -> show that single section with a back button.
  const [mobileOpenId, setMobileOpenId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Desktop-only: feed the most-visible section back into the store
  // so the left rail highlights the row the user is reading.
  useEffect(() => {
    if (isMobile) {
      return;
    }
    const root = bodyRef.current;
    if (!root) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry whose visible fraction is the largest; that's
        // the section the user is most likely "looking at".
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) {
          setActiveCategoryId(visible.target.id);
        }
      },
      {
        root: null,
        // -80px top margin to clear the top bar, -60% bottom margin
        // so the next section takes over before the current one is
        // half-gone.
        rootMargin: "-80px 0px -60% 0px",
        threshold: [0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    const nodes = settingsCategories
      .map((c) => document.getElementById(c.id))
      .filter((el): el is HTMLElement => el !== null);
    nodes.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [isMobile, setActiveCategoryId]);

  const desktopBody = (
    <Paper
      ref={bodyRef}
      elevation={0}
      sx={{
        height: "100%",
        overflowY: "auto",
        px: { xs: 2, md: 4 },
        pt: 4,
        pb: "30vh",
      }}
    >
      {settingsCategories.map((category) => (
        <SettingsSection
          key={category.id}
          id={category.id}
          label={category.label}
          resetLogic={category.resetLogic}
        >
          {category.settingsContent}
        </SettingsSection>
      ))}
    </Paper>
  );

  const mobileList = useMemo(
    () => (
      <Box sx={{ px: 2, py: 2 }}>
        <Typography variant="h6" sx={{ pb: 1 }}>
          Settings
        </Typography>
        <List>
          {settingsCategories.map((category) => (
            <ListItemButton
              key={category.id}
              onClick={() => setMobileOpenId(category.id)}
            >
              {category.icon !== undefined && (
                <ListItemIcon>{category.icon}</ListItemIcon>
              )}
              <ListItemText primary={category.label} />
            </ListItemButton>
          ))}
        </List>
      </Box>
    ),
    [],
  );

  const mobileSection =
    mobileOpenId !== null &&
    (() => {
      const category = settingsCategories.find((c) => c.id === mobileOpenId);
      if (!category) {
        return mobileList;
      }
      return (
        <Box sx={{ px: 2, py: 2 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", pb: 1 }}
          >
            <IconButton
              aria-label="Back to settings categories"
              onClick={() => setMobileOpenId(null)}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h6">{category.label}</Typography>
          </Stack>
          <SettingsSection
            key={`${category.id}-mobile`}
            id={`${category.id}-mobile`}
            label={category.label}
            resetLogic={category.resetLogic}
          >
            {category.settingsContent}
          </SettingsSection>
        </Box>
      );
    })();

  if (isMobile) {
    return <Box>{mobileOpenId !== null ? mobileSection : mobileList}</Box>;
  }
  return desktopBody;
};

export default SettingsPage;
