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

/**
 * Persisted-cache namespace version. Bump this whenever the shape of
 * any cached `queryFn` result changes in an incompatible way so the
 * old cache gets discarded on first load.
 *
 * `v3-directories-include-flags` corresponds to the migration of
 * `GET /api/directories` to the new
 * `include_parents` / `include_child_dirs` / `include_child_notes`
 * query flags. The backend now requires the flags to be explicit;
 * cached responses that were fetched without the flags are missing
 * `parent_dir_ids` and `child_dir_ids`, so the hierarchy builder
 * would see orphans. Bumping the buster flushes them on first load.
 *
 * (The previous `v2-notes-reply` bump covered the migration of
 * `search`/`list` responses from a flat `MinimalNote[]` to the
 * `NotesReply` envelope.)
 */
const PERSIST_CACHE_BUSTER = "v3-directories-include-flags";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: localStoragePersister,
        buster: PERSIST_CACHE_BUSTER,
      }}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
);
