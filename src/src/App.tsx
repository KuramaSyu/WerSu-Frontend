import { lazy, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { MotionConfig } from "framer-motion";
import { useThemeStore } from "./zustand/useThemeStore";
import { useThemePreferenceSync } from "./hooks/useThemePreferenceSync";
import { useCustomThemesSync } from "./hooks/useCustomThemes";
import { useThemeImageRepair } from "./hooks/useThemeImageRepair";
import { useDevicePerformanceHint } from "./hooks/useDevicePerformanceHint";
import { FeatureFlagName, useFeatureStore } from "./zustand/FeatureStore";

import "./App.css";
import { HomePage } from "./pages/Home/Main";
import InfoDisplay from "./pages/MainPage/InfoDisplay";
import { ShortcutPulse } from "./components/ShortcutPulse";
import { ThemeFavicon } from "./components/ThemeFavicon";
import { recordNavigation } from "./utils/navigationMemento";
import { Bootstrap } from "./Bootstrap";
import { LoginPage } from "./pages/LoginPage/Main";

// PERF - only load pages on request
// Route-level code splitting. Everything that is not needed for the
// first paint (editor stack, swagger-ui, mermaid/graph, codemirror,
// settings) loads on navigation. Suspense boundaries live in
// `AppShell` (shell stays mounted) and in the note pages (editor-only
// fallback), so a slow chunk never blanks the app.
const SwaggerDocs = lazy(() =>
  import("./pages/docs/Main").then((m) => ({ default: m.SwaggerDocs })),
);
const NotePage = lazy(() =>
  import("./pages/NotePage/Main").then((m) => ({ default: m.NotePage })),
);
const PublicNotePage = lazy(() =>
  import("./pages/PublicNotePage/Main").then((m) => ({
    default: m.PublicNotePage,
  })),
);
const DirectoryView = lazy(() =>
  import("./pages/DirectoryView/Main").then((m) => ({
    default: m.DirectoryView,
  })),
);
const TagView = lazy(() =>
  import("./pages/TagView/Main").then((m) => ({ default: m.TagView })),
);
const DirectoryEditPage = lazy(() =>
  import("./pages/DirectoryEdit/Main").then((m) => ({
    default: m.DirectoryEditPage,
  })),
);
const CreateSubdirectoryPage = lazy(() =>
  import("./pages/DirectoryCreate/Main").then((m) => ({
    default: m.CreateSubdirectoryPage,
  })),
);
const FileGraphPage = lazy(() =>
  import("./pages/FileGraph/Main").then((m) => ({
    default: m.FileGraphPage,
  })),
);
const SettingsPage = lazy(() => import("./pages/Settings/Main"));
const ShelfEditPage = lazy(() =>
  import("./pages/ShelfEdit/Main").then((m) => ({
    default: m.ShelfEditPage,
  })),
);
const ShelfTabRedirect = lazy(() =>
  import("./pages/ShelfEdit/Main").then((m) => ({
    default: m.ShelfTabRedirect,
  })),
);
const SharesPage = lazy(() =>
  import("./pages/Shares/Main").then((m) => ({ default: m.SharesPage })),
);
const RolesPage = lazy(() =>
  import("./pages/Roles/RolesPage").then((m) => ({
    default: m.RolesPage,
  })),
);
const RoleDetailPage = lazy(() =>
  import("./pages/Roles/RoleDetailPage").then((m) => ({
    default: m.RoleDetailPage,
  })),
);
const ShortcutsPage = lazy(() =>
  import("./pages/Shortcuts/Main").then((m) => ({
    default: m.ShortcutsPage,
  })),
);

import "@fontsource-variable/fraunces";
import "@fontsource-variable/fraunces/wght-italic.css";
import "@fontsource/fira-sans/400.css";
import "@fontsource/fira-sans/400-italic.css";
import "@fontsource/fira-sans/500.css";
import "@fontsource/fira-sans/500-italic.css";
import "@fontsource/fira-sans/700.css";
import "@fontsource/fira-sans/700-italic.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/400-italic.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/500-italic.css";
import "@fontsource/jetbrains-mono/700.css";
import "@fontsource/jetbrains-mono/700-italic.css";
import { LayoutProvider } from "./LayoutProvider";
import { AppShell } from "./AppShell";
import { RequireAuth } from "./components/RequireAuth";
import { RightClickMenuHost } from "./components/RightClick/RightClickMenuHost";
import { DirectoryDialogHost } from "./components/RightClick/DirectoryDialogHost";

/**
 * records the navigation of the user, so that the back button works as expected
 * @returns
 */
const NavigationRecorder: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const path = `${location.pathname}${location.search}${location.hash}`;
    recordNavigation(path);
  }, [location]);

  return null;
};

function App() {
  const { theme } = useThemeStore();
  const reduceMotion = useFeatureStore(
    (s) => s.flags[FeatureFlagName.ReduceMotion],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.reduceMotion = reduceMotion ? "true" : "false";
    return () => {
      delete root.dataset.reduceMotion;
    };
  }, [reduceMotion]);

  // Apply the signed-in user's synced theme preference unless this device
  // has pinned its theme (see the lock button in the theme picker).
  useThemePreferenceSync();

  // Register custom themes synced through the keyed `custom-themes`
  // preference and apply the active shelf theme when the user has not
  // selected one of their own.
  useCustomThemesSync();

  // Re-download corrupt sources and regenerate missing blurred blobs for
  // device-local generated themes after a lost IndexedDB state.
  useThemeImageRepair();

  // Turn Performance mode on automatically when the Network Information
  // API reports a sub-4G link. Settings/UserMenu call the same hook for
  // display; the auto-enable guard makes this idempotent.
  useDevicePerformanceHint({ sampleRuntime: false });

  // QueryClientProvider lives in main.tsx; do not add a second one here
  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      <ThemeProvider theme={theme}>
        <ThemeFavicon />
        <Router>
          <Bootstrap />
          <NavigationRecorder />
          <LayoutProvider>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/public/n/:share_id"
                  element={<PublicNotePage />}
                />
                <Route path="/docs/*" element={<SwaggerDocs />} />
                <Route element={<RequireAuth />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/n/:id" element={<NotePage />} />
                  <Route path="/d/:id" element={<DirectoryView />} />
                  <Route path="/t/:id" element={<TagView />} />
                  <Route path="/d/:id/edit" element={<DirectoryEditPage />} />
                  <Route
                    path="/d/:id/new"
                    element={<CreateSubdirectoryPage />}
                  />
                  <Route path="/graph" element={<FileGraphPage />} />
                  <Route path="/shares" element={<SharesPage />} />
                  <Route path="/roles" element={<RolesPage />} />
                  <Route path="/role/:id" element={<RoleDetailPage />} />
                  <Route path="/shortcuts" element={<ShortcutsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/shelves/:shelfId" element={<ShelfEditPage />} />
                  <Route
                    path="/shelves/:shelfId/edit"
                    element={<ShelfTabRedirect tab="settings" />}
                  />
                  <Route
                    path="/shelves/:shelfId/rules"
                    element={<ShelfTabRedirect tab="rules" />}
                  />
                </Route>
              </Route>
            </Routes>
          </LayoutProvider>
          <InfoDisplay />
          <ShortcutPulse />
          <RightClickMenuHost />
          <DirectoryDialogHost />
        </Router>
      </ThemeProvider>
    </MotionConfig>
  );
}

export default App;
