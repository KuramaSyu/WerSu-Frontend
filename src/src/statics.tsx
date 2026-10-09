declare global {
  interface ImportMetaEnv {
    readonly VITE_BACKEND_URL?: string;
    readonly VITE_HOCUSPOCUS_WS_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  // Runtime config injected by `docker/20-runtime-env.sh`; absent keys fall through to the build-time `VITE_*` fallback.
  interface Window {
    readonly __ENV__?: {
      readonly BACKEND_URL?: string;
      readonly HOCUSPOCUS_WS_URL?: string;
    };
  }
}

// Prefer runtime env (Docker `-e` -> `/env.js`) and fall back to build-time `VITE_*`; the `typeof window` guard keeps this evaluable in Vitest's `node` env and SSR.
const runtimeEnv = typeof window !== "undefined" ? window.__ENV__ : undefined;

export const BACKEND_BASE =
  runtimeEnv?.BACKEND_URL ?? import.meta.env.VITE_BACKEND_URL ?? "";
export const HOCUSPOCUS_WS_URL =
  runtimeEnv?.HOCUSPOCUS_WS_URL ?? import.meta.env.VITE_HOCUSPOCUS_WS_URL ?? "";
export const M1 = "0.25rem";
export const M2 = "0.5rem";
export const M3 = "1rem";
export const M4 = "2rem";
export const M5 = "4rem";
export const M6 = "8rem";
export const M7 = "12rem";
export const M8 = "16rem";
/**
 * TopBar elevation
 */
export const TOP_BAR_ELEVATION = 4;

/**
 * Side-rail elevation (left and right). Kept distinct from
 * TOP_BAR_ELEVATION so TranslucentPaper can tune the top bar
 * opaque without flattening the rails.
 */
export const RAIL_ELEVATION = 2;

/**
 * M5 is too big and M4 is too small
 */
export const TOP_BAR_HEIGHT = "3.5rem";
/**
 * Default max-width for the note editor body
 */

export const NOTE_EDITOR_A4_WIDTH = "52rem"; /**
 * Normally 48 which looks too small
 */
export const COLLAPSED_PANEL_SIZE = "0px";
/**
 * Vertical spacing we need in mobile view, so that
 * FABs are located properly
 */
export const MOBILE_BOTTOM_BAR_CLEARANCE = "6rem";
/**
 * Elevation for Main Panel. All others should have elevation below that
 */
export const MAIN_PANEL_ELEVATION = 1;

/**
 * Storage keys for the persisted zustand stores; v
 * alues must match each store's persist name so the cross-tab listener in Bootstrap can match them.
 */
export const PERSIST_KEYS = {
  backgroundImageLibrary: "background-image-library",
  selectedBackgroundImage: "selected-background-image",
  appearance: "appearance-storage",
} as const;
