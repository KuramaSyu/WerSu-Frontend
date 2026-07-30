import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * User-selectable hljs themes for code blocks.
 *
 * Bundled with `highlight.js` at `node_modules/highlight.js/styles/`.
 * Hardcoded so a hljs upgrade that drops a theme surfaces as a
 * compile error instead of silently breaking the picker.
 */
export const CODE_BLOCK_THEMES = [
  "tokyo-night-dark",
  "tokyo-night-light",
  "atom-one-dark",
  "atom-one-light",
  "gruvbox-dark-pale",
  "gruvbox-light-hard",
  "material-palenight",
] as const;

export type CodeBlockTheme = (typeof CODE_BLOCK_THEMES)[number];

export const DEFAULT_CODE_BLOCK_THEME_LIGHT: CodeBlockTheme =
  "tokyo-night-light";
export const DEFAULT_CODE_BLOCK_THEME_DARK: CodeBlockTheme =
  "material-palenight";

/**
 * Appearance settings: code-block theme + future look-and-feel knobs.
 *
 * Persisted to `sessionStorage` (never `localStorage`, never cookies):
 * picks live for the browser session and don't ride along on every
 * request to the API. Keyed separately from `useThemeStore` so a
 * session reset here doesn't drop the theme choice.
 */
interface AppearanceSettingsState {
  codeBlockThemeLight: CodeBlockTheme;
  codeBlockThemeDark: CodeBlockTheme;
  setCodeBlockThemeLight: (theme: CodeBlockTheme) => void;
  setCodeBlockThemeDark: (theme: CodeBlockTheme) => void;
}

const isCodeBlockTheme = (value: unknown): value is CodeBlockTheme =>
  typeof value === "string" &&
  (CODE_BLOCK_THEMES as readonly string[]).includes(value);

export const useAppearanceSettings = create<AppearanceSettingsState>()(
  persist(
    (set) => ({
      codeBlockThemeLight: DEFAULT_CODE_BLOCK_THEME_LIGHT,
      codeBlockThemeDark: DEFAULT_CODE_BLOCK_THEME_DARK,
      setCodeBlockThemeLight: (theme) => set({ codeBlockThemeLight: theme }),
      setCodeBlockThemeDark: (theme) => set({ codeBlockThemeDark: theme }),
    }),
    {
      name: "appearance-storage",
      storage: createJSONStorage(() => sessionStorage),
      version: 1,
      partialize: (state) => ({
        codeBlockThemeLight: state.codeBlockThemeLight,
        codeBlockThemeDark: state.codeBlockThemeDark,
      }),
      merge: (persisted, current) => {
        // Defensive: an old/foreign shape must not crash the store.
        const p = (persisted ?? {}) as Partial<AppearanceSettingsState>;
        return {
          ...current,
          codeBlockThemeLight: isCodeBlockTheme(p.codeBlockThemeLight)
            ? p.codeBlockThemeLight
            : current.codeBlockThemeLight,
          codeBlockThemeDark: isCodeBlockTheme(p.codeBlockThemeDark)
            ? p.codeBlockThemeDark
            : current.codeBlockThemeDark,
        };
      },
    },
  ),
);
