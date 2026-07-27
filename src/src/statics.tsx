declare global {
  interface ImportMetaEnv {
    readonly VITE_BACKEND_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL ?? "";
export const HOCUSPOCUS_WS_URL = import.meta.env.VITE_HOCUSPOCUS_WS_URL ?? "";
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
 * Default max-width for the note editor body, expressed in `rem` so the
 * layout scales with the user's font-size preference. A4 portrait at
 * 96 DPI is ~8.27in; 48rem at the default 16px root font-size renders
 * to 768px, which sits comfortably within physical A4 on most screens
 * without forcing horizontal scroll on narrower windows.
 */
export const NOTE_EDITOR_A4_WIDTH = "48rem";
