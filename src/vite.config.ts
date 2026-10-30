import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * In dev only, copy `src/dev-msw/mockServiceWorker.js` to the served
 * root so `worker.start({ serviceWorker: { url: "/mockServiceWorker.js" } })`
 * can fetch it. In production builds Vite tree-shakes the mocks graph
 * and the worker file is never copied.
 */
function devMswWorkerPlugin(): Plugin {
  return {
    name: "dev-msw-worker",
    apply: "serve",
    configureServer(server) {
      const here = dirname(fileURLToPath(import.meta.url));
      const src = resolve(here, "src/dev-msw/mockServiceWorker.js");
      const outDir = resolve(server.config.root, "mockServiceWorker.js");
      try {
        copyFileSync(src, outDir);
      } catch {
        // ignore — production runs, or the file moved
      }
      server.httpServer?.once("listening", () => {
        mkdirSync(dirname(outDir), { recursive: true });
        copyFileSync(src, outDir);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  css: {
    devSourcemap: false,
  },
  plugins: [react(), devMswWorkerPlugin()],
  // prosemirror of `@tiptap/y-tiptap@3.0.9` collides with `@tiptap/extension-collaboration@3.31.x`.
  // Constructor checks across the two copies then
  // throw "Unexpected content type in insert operation" when y-tiptap's
  // binding tries to write a `Y.XmlElement`.
  // Force a single resolution path so all `yjs` imports share one module.
  resolve: {
    dedupe: ["yjs"],
  },
  // copies from .env, so that CI on github works
  test: {
    env: {
      VITE_BACKEND_URL: "http://localhost:8080",
      VITE_HOCUSPOCUS_WS_URL: "ws://localhost:8666",
    },
    server: {
      deps: {
        // mui material brings nearly every test to crash; the
        // material-colour utilities ship extensionless deep imports
        // that Node's ESM resolver cannot follow.
        inline: ["@mui/material", "@material/material-color-utilities"],
      },
    },
  },
});
