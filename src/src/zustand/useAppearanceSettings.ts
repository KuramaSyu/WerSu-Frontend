import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PERSIST_KEYS } from "../statics";

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

/** Default CSS backdrop-blur amount (pixels) for the note editor background. */
export const DEFAULT_NOTE_EDITOR_BLUR_AMOUNT = 12;

/** Upper bound for the note-editor background blur slider. */
export const MAX_NOTE_EDITOR_BLUR_AMOUNT = 40;

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
  /** CSS backdrop-blur amount in pixels for the note editor background. */
  noteEditorBackgroundBlurAmount: number;
  setCodeBlockThemeLight: (theme: CodeBlockTheme) => void;
  setCodeBlockThemeDark: (theme: CodeBlockTheme) => void;
  setNoteEditorBackgroundBlurAmount: (amount: number) => void;
}

const isCodeBlockTheme = (value: unknown): value is CodeBlockTheme =>
  typeof value === "string" &&
  (CODE_BLOCK_THEMES as readonly string[]).includes(value);

export const useAppearanceSettings = create<AppearanceSettingsState>()(
  persist(
    (set) => ({
      codeBlockThemeLight: DEFAULT_CODE_BLOCK_THEME_LIGHT,
      codeBlockThemeDark: DEFAULT_CODE_BLOCK_THEME_DARK,
      noteEditorBackgroundBlurAmount: DEFAULT_NOTE_EDITOR_BLUR_AMOUNT,
      setCodeBlockThemeLight: (theme) => set({ codeBlockThemeLight: theme }),
      setCodeBlockThemeDark: (theme) => set({ codeBlockThemeDark: theme }),
      setNoteEditorBackgroundBlurAmount: (amount) =>
        set({
          noteEditorBackgroundBlurAmount: Math.max(
            0,
            Math.min(MAX_NOTE_EDITOR_BLUR_AMOUNT, amount),
          ),
        }),
    }),
    {
      name: PERSIST_KEYS.appearance,
      storage: createJSONStorage(() => sessionStorage),
      version: 1,
      partialize: (state) => ({
        codeBlockThemeLight: state.codeBlockThemeLight,
        codeBlockThemeDark: state.codeBlockThemeDark,
        noteEditorBackgroundBlurAmount: state.noteEditorBackgroundBlurAmount,
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
          noteEditorBackgroundBlurAmount:
            typeof p.noteEditorBackgroundBlurAmount === "number" &&
            Number.isFinite(p.noteEditorBackgroundBlurAmount)
              ? Math.max(
                  0,
                  Math.min(
                    MAX_NOTE_EDITOR_BLUR_AMOUNT,
                    p.noteEditorBackgroundBlurAmount,
                  ),
                )
              : current.noteEditorBackgroundBlurAmount,
        };
      },
    },
  ),
);
