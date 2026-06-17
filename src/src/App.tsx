import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useThemeStore } from "./zustand/useThemeStore";

import "./App.css";
import { MainPage } from "./pages/MainPage/Main";
import { Box } from "@mui/material";
import { SwaggerDocs } from "./pages/docs/Main";
import InfoDisplay from "./pages/MainPage/InfoDisplay";
import { NotePage } from "./pages/NotePage/Main";
import { DirectoryView } from "./pages/DirectoryView/Main";
import { DirectoryEditPage } from "./pages/DirectoryEdit/Main";
import { FileGraphPage } from "./pages/FileGraph/Main";
import { recordNavigation } from "./utils/navigationMemento";
import { Bootstrap } from "./Bootstrap";
import "@fontsource/fira-sans/300.css";
import "@fontsource/fira-sans/400.css";
import "@fontsource/fira-sans/500.css";
import "@fontsource/fira-sans/700.css";
import { LayoutProvider } from "./LayoutProvider";
import { AppShell } from "./AppShell";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
    },
  },
});

const localStoragePersister = createAsyncStoragePersister({
  storage: window.localStorage,
});

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

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: localStoragePersister }}
    >
      <ThemeProvider theme={theme}>
        <Bootstrap />
        {/* <CssBaseline /> */}
        <Router>
          <Box
            sx={{
              width: "100vw",
              height: "100vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden", // Prevents content from growing beyond 100vh
              backgroundColor: theme.palette.background.default,
            }}
          >
            <NavigationRecorder />
            <LayoutProvider>
              <Routes>
                <Route element={<AppShell />}>
                  <Route path="/" element={<MainPage />} />
                  <Route path="/n/:id" element={<NotePage />} />
                  <Route path="/d/:id" element={<DirectoryView />} />
                  <Route path="/d/:id/edit" element={<DirectoryEditPage />} />
                  <Route path="/graph" element={<FileGraphPage />} />
                  <Route path="/docs/*" element={<SwaggerDocs />} />
                </Route>
              </Routes>
            </LayoutProvider>
            <InfoDisplay />
          </Box>
        </Router>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

export default App;
