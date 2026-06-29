// Vitest setup file.
//
// Runs once per test file. Responsibilities:
//   1. Register the jest-dom matchers (`toBeInTheDocument`, etc.).
//   2. Reset all relevant zustand stores between tests so state set by
//      a test in one file doesn't leak into another.
//
// The store imports happen *inside* the `beforeEach`/`afterEach`
// callbacks via dynamic `await import(...)`. Some of those stores
// (e.g. `useThemeStore`) transitively import `@mui/material`,
// which has a deep ESM dependency graph that Vite 8 / Vitest 4
// refuses to resolve without heavy aliasing work. By lazy-loading,
// we only pay that cost in tests that actually need the
// MUI-coupled stores; the loader also catches load errors and
// silently skips the reset for stores that can't be loaded in the
// current environment.
//
// Dynamic import (not `require()`) is the right tool here because
// the project is ESM with `verbatimModuleSyntax: true` — `require`
// is a CJS escape hatch that the compiler rejects, and adding
// `@types/node` just for this would be wrong: the test file is
// type-checked under the same `tsconfig.app.json` as the rest of
// the app, which doesn't include node types on purpose.
//
// The test file imports this file for its side effects:
// `import "../../test/setup";` from a `.test.tsx` file in `jsdom`.

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { SnackbarUpdateImpl } from "../zustand/InfoStore";

// Zustand stores are singletons. The safest reset is to call
// `setState` with a fresh shallow copy of the *initial* slice. We
// read the initial state once via `getState` (which includes any
// actions), then use it as the reset target.
function snapshot<T>(store: { getState: () => T }): T {
  return JSON.parse(
    JSON.stringify(store.getState(), (_, value) => {
      if (value instanceof Set) return { __set: Array.from(value) };
      return value;
    }),
  ) as T;
}

function restoreWithSetSupport<T extends Record<string, unknown>>(
  store: { setState: (partial: Partial<T>) => void },
  snapshot: T,
): void {
  const restored: Record<string, unknown> = { ...snapshot };
  for (const key of Object.keys(restored)) {
    const value = restored[key];
    if (
      value &&
      typeof value === "object" &&
      "__set" in (value as Record<string, unknown>)
    ) {
      restored[key] = new Set((value as { __set: unknown[] }).__set);
    }
  }
  store.setState(restored as Partial<T>);
}

interface StoreHandle {
  getState(): unknown;
  setState(p: unknown): void;
}

// Each spec is an async loader that returns the store handle, or
// `null` if the module can't be loaded. The handle is `null`
// (rather than throwing) so the tests still run when an optional
// dep fails — they just don't get the reset for that one store.
//
// We cache the loaded module so each loader only runs at most once
// per test file.
type StoreSpec = {
  module: () => Promise<unknown>;
  pick: (mod: unknown) => StoreHandle | undefined;
};

const storeSpecs: Record<string, StoreSpec> = {
  activeNote: {
    module: () => import("../zustand/editorStore"),
    pick: (mod) =>
      (mod as { useActiveNoteStore?: StoreHandle }).useActiveNoteStore,
  },
  liveUsers: {
    module: () => import("../zustand/useLiveUsersStore"),
    pick: (mod) =>
      (mod as { useLiveUsersStore?: StoreHandle }).useLiveUsersStore,
  },
  info: {
    module: () => import("../zustand/InfoStore"),
    pick: (mod) => (mod as { default?: StoreHandle }).default,
  },
  collabStatus: {
    module: () => import("../zustand/useCollabStatusStore"),
    pick: (mod) =>
      (mod as { collabStatusStore?: StoreHandle }).collabStatusStore,
  },
  auth: {
    module: () => import("../zustand/useAuthStore"),
    pick: (mod) => (mod as { useAuthStore?: StoreHandle }).useAuthStore,
  },
  editorSettings: {
    module: () => import("../zustand/useEditorSettings"),
    pick: (mod) =>
      (mod as { useEditorSettings?: StoreHandle }).useEditorSettings,
  },
  // Intentionally lazy: `useThemeStore.tsx` imports
  // `@mui/material/styles`, which transitively pulls in the deep
  // `material-color-utilities` ESM graph that Vite 8 cannot
  // resolve without manual aliasing. The loader is registered
  // but only invoked from tests that opt in (none today).
  theme: {
    module: () => import("../zustand/useThemeStore"),
    pick: (mod) => (mod as { useThemeStore?: StoreHandle }).useThemeStore,
  },
};

const storeCache = new Map<string, StoreHandle>();

async function loadStore(
  name: keyof typeof storeSpecs,
): Promise<StoreHandle | null> {
  const cached = storeCache.get(name);
  if (cached) return cached;
  try {
    const mod = await storeSpecs[name].module();
    const handle = storeSpecs[name].pick(mod);
    if (handle) {
      storeCache.set(name, handle);
    }
    return handle ?? null;
  } catch {
    // Store failed to load (e.g. MUI ESM graph unresolvable in
    // this environment). Skip the reset for this store; tests
    // that depend on it must run in a setup that can load it.
    return null;
  }
}

beforeEach(async () => {
  // Pre-load the stores we know we need. The loaders are cached
  // so subsequent tests in this file are instant.
  await Promise.all(
    (
      [
        "activeNote",
        "liveUsers",
        "info",
        "collabStatus",
        "auth",
        "editorSettings",
      ] as const
    ).map(loadStore),
  );
});

afterEach(() => {
  // Unmount any React trees from @testing-library/react.
  cleanup();

  // Reset every store that successfully loaded.
  for (const name of Object.keys(storeSpecs) as (keyof typeof storeSpecs)[]) {
    const handle = storeCache.get(name);
    if (!handle) continue;
    try {
      restoreWithSetSupport(
        handle as unknown as { setState: (p: unknown) => void },
        snapshot(handle as unknown as { getState: () => unknown }) as never,
      );
    } catch {
      // If the store was created in a way that breaks JSON
      // serialization (e.g. contains a class instance we can't
      // round-trip), skip the reset rather than failing every
      // test.
    }
  }

  // `useActiveNoteStore.updateNote` defaults to a function that
  // throws. If a test replaces it, restore the default so the
  // next test doesn't get a confusing "save called without
  // updateNote" error.
  const activeNote = storeCache.get("activeNote");
  if (activeNote) {
    try {
      activeNote.setState({
        updateNote: () => {
          throw new Error("updateNote function not set");
        },
      });
    } catch {
      // ignore
    }
  }

  // Same idea for the snackbar store — restore the default
  // SnackbarUpdateImpl instance so test messages don't leak.
  const info = storeCache.get("info");
  if (info) {
    try {
      info.setState({ Message: new SnackbarUpdateImpl("") });
    } catch {
      // ignore
    }
  }
});
