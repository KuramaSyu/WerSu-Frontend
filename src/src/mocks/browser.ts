import { setupWorker, type SetupWorker } from "msw/browser";
import { handlers } from "./handlers";

/**
 * Browser-side MSW worker.
 *
 * `setApiMode("test" | "rest")` swaps the active handler set at
 * runtime. Components never need to re-resolve any API instance —
 * the next `fetch` call is intercepted by whichever set is active.
 *
 * The module only exposes `setApiMode` (and the lazy `worker`). It
 * must be loaded via `import(".../mocks/browser")` from a code path
 * gated by `import.meta.env.DEV`, so Vite tree-shakes the whole
 * `mocks/` graph out of production bundles.
 */

let worker: SetupWorker | null = null;
let started = false;
let activeMode: "rest" | "test" = "rest";

async function ensureWorker(): Promise<SetupWorker> {
  if (!worker) {
    worker = setupWorker(...handlers);
  }
  return worker;
}

/**
 * Install/refresh handlers based on the desired mode.
 *
 * - On first call with `mode === "test"`, the worker is started.
 * - On every call, `resetHandlers(...activeHandlers)` ensures an
 *   unhandled request never falls through to the network in test mode.
 */
export async function setApiMode(mode: "rest" | "test"): Promise<void> {
  if (mode === activeMode && started) {
    return;
  }
  const w = await ensureWorker();
  if (mode === "test") {
    if (!started) {
      await w.start({
        onUnhandledRequest: "bypass",
        serviceWorker: { url: "/mockServiceWorker.js" },
      });
      started = true;
    }
    await w.resetHandlers(...handlers);
  } else {
    // `bypass` clears every handler so requests fall through.
    if (started) {
      w.resetHandlers();
    }
  }
  activeMode = mode;
}

/** Test helper: stop the worker entirely. Not used in production. */
export async function stopApiMocks(): Promise<void> {
  if (!worker || !started) return;
  await worker.stop();
  started = false;
  activeMode = "rest";
}
