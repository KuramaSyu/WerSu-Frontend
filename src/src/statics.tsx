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
 * MUI `elevation` value used by the top `AppBar` and (in dark mode) by
 * the side-rail `Paper` shells. Keeping them in sync via this constant
 * means a future tweak happens in one place.
 */
export const TOP_BAR_ELEVATION = 4;

/**
 * M5 is too big and M4 is too small
 */
export const TOP_BAR_HEIGHT = "3.5rem";
/**
 * Default max-width for the note editor body, expressed in `rem` so the
 * layout scales with the user's font-size preference. A4 portrait at
 * 96 DPI is ~8.27in; 48rem at the default 16px root font-size renders
 * to 768px, which sits comfortably within physical A4 on most screens
 * without forcing horizontal scroll on narrower windows.
 */

export const NOTE_EDITOR_A4_WIDTH = "52rem"; /**
 * Normally 48 which looks too small
 */
export const COLLAPSED_PANEL_SIZE = "0px";
/**
 * Vertical clearance the mobile bottom bar needs from anything
 * floating at the bottom of the viewport. Use this for the
 * `bottom` (or `paddingBottom`) of any FAB / speed-dial / fixed
 * action surface that sits over the mobile canvas, so the action
 * stays reachable and doesn't slide under the bottom bar.
 *
 * Same value backs the AppShell's mobile `paddingBottom` so the
 * scroll container, the FAB stack, and the bar all line up.
 */
export const MOBILE_BOTTOM_BAR_CLEARANCE = "6rem";
/**
 * Default `elevation` for the main-content `Paper` (the cell that
 * hosts routed pages: home, directory, settings, note editor, etc.).
 * Subtle on purpose so the side rails recede behind the canvas
 * without competing with any deeper card the page mounts.
 */
export const MAIN_PANEL_ELEVATION = 1;
