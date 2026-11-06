import { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { useThemeStore } from "./zustand/useThemeStore";
import { useThemePreferenceSync } from "./hooks/useThemePreferenceSync";
import { useCustomThemesSync } from "./hooks/useCustomThemes";
import { useThemeImageRepair } from "./hooks/useThemeImageRepair";

import "./App.css";
import { HomePage } from "./pages/Home/Main";
import { SwaggerDocs } from "./pages/docs/Main";
import InfoDisplay from "./pages/MainPage/InfoDisplay";
import { ShortcutPulse } from "./components/ShortcutPulse";
import { NotePage } from "./pages/NotePage/Main";
import { DirectoryView } from "./pages/DirectoryView/Main";
import { DirectoryEditPage } from "./pages/DirectoryEdit/Main";
import { CreateSubdirectoryPage } from "./pages/DirectoryCreate/Main";
import { FileGraphPage } from "./pages/FileGraph/Main";
import { recordNavigation } from "./utils/navigationMemento";
import { Bootstrap } from "./Bootstrap";
import "@fontsource/fira-sans/300.css";
import "@fontsource/fira-sans/400.css";
import "@fontsource/fira-sans/500.css";
import "@fontsource/fira-sans/700.css";
import { LayoutProvider } from "./LayoutProvider";
import { AppShell } from "./AppShell";
import { RequireAuth } from "./components/RequireAuth";
import { RightClickMenuHost } from "./components/RightClick/RightClickMenuHost";
import { DirectoryDialogHost } from "./components/RightClick/DirectoryDialogHost";
import { PublicNotePage } from "./pages/PublicNotePage/Main";
import SettingsPage from "./pages/Settings/Main";
import { LoginPage } from "./pages/LoginPage/Main";
import { RulesPage } from "./pages/Rules/RulesPage";
import { ShelfEditPage } from "./pages/ShelfEdit/Main";
import { SharesPage } from "./pages/Shares/Main";
import { RolesPage } from "./pages/Roles/RolesPage";
import { RoleDetailPage } from "./pages/Roles/RoleDetailPage";
import { ShortcutsPage } from "./pages/Shortcuts/Main";

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

  // QueryClientProvider lives in main.tsx; do not add a second one here
  return (
    <ThemeProvider theme={theme}>
      <Router>
        <Bootstrap />
        <NavigationRecorder />
        <LayoutProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/public/n/:share_id" element={<PublicNotePage />} />
              <Route path="/docs/*" element={<SwaggerDocs />} />
              <Route element={<RequireAuth />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/n/:id" element={<NotePage />} />
                <Route path="/d/:id" element={<DirectoryView />} />
                <Route path="/d/:id/edit" element={<DirectoryEditPage />} />
                <Route path="/d/:id/new" element={<CreateSubdirectoryPage />} />
                <Route path="/graph" element={<FileGraphPage />} />
                <Route path="/shares" element={<SharesPage />} />
                <Route path="/roles" element={<RolesPage />} />
                <Route path="/role/:id" element={<RoleDetailPage />} />
                <Route path="/shortcuts" element={<ShortcutsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/shelves/:shelfId/rules" element={<RulesPage />} />
                <Route
                  path="/shelves/:shelfId/edit"
                  element={<ShelfEditPage />}
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
  );
}

export default App;
