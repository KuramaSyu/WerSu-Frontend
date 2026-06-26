import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import "./index.css";
import "katex/dist/katex.min.css";
import App from "./App.tsx";
import { queryClient } from "./api/queryClient";

const localStoragePersister = createAsyncStoragePersister({
  storage: window.localStorage,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: localStoragePersister }}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
);
