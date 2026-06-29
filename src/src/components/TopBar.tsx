/**
 * Backwards-compatible entry point for the top bar.
 *
 * The implementation lives in `./TopBar/TopBar.tsx` (alongside its
 * helper sub-components). This file re-exports its default so every
 * existing `import TopBar from ".../components/TopBar"` keeps
 * resolving without touching call sites — `AppShell.tsx`,
 * `MainPage/Main.tsx`, `NotePage/Main.tsx`, `FileGraph/Main.tsx`,
 * `DirectoryView/Main.tsx`, `DirectoryEdit/Main.tsx`.
 */
export { default } from "./TopBar/TopBar";
export type { TopBarProps } from "./TopBar/TopBar";
