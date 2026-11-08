import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PERSIST_KEYS } from "../statics";
import {
  DOT_GRID_ALGORITHMS,
  type DotGridAlgorithm,
} from "../utils/dotGridBackground";

export { DOT_GRID_ALGORITHMS, type DotGridAlgorithm };

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

// --- Outlet dot-grid texture ---------------------------------------------

export const DEFAULT_DOT_GRID_ENABLED = true;
export const DEFAULT_DOT_GRID_ALGORITHM: DotGridAlgorithm = "hills";
export const DEFAULT_DOT_GRID_SPACING = 12;
export const MIN_DOT_GRID_SPACING = 8;
export const MAX_DOT_GRID_SPACING = 24;
export const DEFAULT_DOT_GRID_MIN_OPACITY = 0.06;
export const DEFAULT_DOT_GRID_MAX_OPACITY = 0.28;
export const MIN_DOT_GRID_OPACITY = 0;
export const MAX_DOT_GRID_OPACITY = 0.6;
export const DEFAULT_DOT_GRID_LIGHT_ANGLE = 225;
export const DEFAULT_DOT_GRID_RELIEF = 1.8;
export const MIN_DOT_GRID_RELIEF = 0.2;
export const MAX_DOT_GRID_RELIEF = 3;
export const DEFAULT_DOT_GRID_DOT_RADIUS = 0.7;
export const MIN_DOT_GRID_DOT_RADIUS = 0.2;
export const MAX_DOT_GRID_DOT_RADIUS = 1.5;
export const DEFAULT_DOT_GRID_FORM_STRENGTH = 0.8;
export const MIN_DOT_GRID_FORM_STRENGTH = 0;
export const MAX_DOT_GRID_FORM_STRENGTH = 2;
export const DEFAULT_DOT_GRID_UNIFORM_ILLUMINATION = false;
export const DEFAULT_DOT_GRID_UNIFORM_OPACITY = 0.16;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360;

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

  /** Whether the outlet paints the procedural dot texture. */
  dotGridEnabled: boolean;
  /** Height-field algorithm that drives dot illumination. */
  dotGridAlgorithm: DotGridAlgorithm;
  /** Distance between dot centres in CSS pixels. */
  dotGridSpacing: number;
  /** Opacity of the darkest dots. */
  dotGridMinOpacity: number;
  /** Opacity of the brightest dots. */
  dotGridMaxOpacity: number;
  /** Light direction in degrees (225 = upper-left). */
  dotGridLightAngle: number;
  /** How strongly the height field is exaggerated. */
  dotGridRelief: number;
  /** Base dot radius in CSS pixels. */
  dotGridDotRadius: number;
  /** Displacement amplitude for form algorithms, in dot cells. */
  dotGridFormStrength: number;
  /** When true every dot gets the same opacity instead of a range. */
  dotGridUniformIllumination: boolean;
  /** Opacity used by every dot in uniform-illumination mode. */
  dotGridUniformOpacity: number;

  setCodeBlockThemeLight: (theme: CodeBlockTheme) => void;
  setCodeBlockThemeDark: (theme: CodeBlockTheme) => void;
  setNoteEditorBackgroundBlurAmount: (amount: number) => void;
  setDotGridEnabled: (enabled: boolean) => void;
  setDotGridAlgorithm: (algorithm: DotGridAlgorithm) => void;
  setDotGridSpacing: (spacing: number) => void;
  setDotGridIlluminationRange: (min: number, max: number) => void;
  setDotGridUniformIllumination: (uniform: boolean) => void;
  setDotGridUniformOpacity: (opacity: number) => void;
  setDotGridLightAngle: (angle: number) => void;
  setDotGridRelief: (relief: number) => void;
  setDotGridDotRadius: (radius: number) => void;
  setDotGridFormStrength: (strength: number) => void;
  resetDotGridSettings: () => void;
}

const isCodeBlockTheme = (value: unknown): value is CodeBlockTheme =>
  typeof value === "string" &&
  (CODE_BLOCK_THEMES as readonly string[]).includes(value);

const isDotGridAlgorithm = (value: unknown): value is DotGridAlgorithm =>
  typeof value === "string" &&
  (DOT_GRID_ALGORITHMS as readonly string[]).includes(value);

const numberOrDefault = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number =>
  typeof value === "number" && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback;

export const useAppearanceSettings = create<AppearanceSettingsState>()(
  persist(
    (set) => ({
      codeBlockThemeLight: DEFAULT_CODE_BLOCK_THEME_LIGHT,
      codeBlockThemeDark: DEFAULT_CODE_BLOCK_THEME_DARK,
      noteEditorBackgroundBlurAmount: DEFAULT_NOTE_EDITOR_BLUR_AMOUNT,

      dotGridEnabled: DEFAULT_DOT_GRID_ENABLED,
      dotGridAlgorithm: DEFAULT_DOT_GRID_ALGORITHM,
      dotGridSpacing: DEFAULT_DOT_GRID_SPACING,
      dotGridMinOpacity: DEFAULT_DOT_GRID_MIN_OPACITY,
      dotGridMaxOpacity: DEFAULT_DOT_GRID_MAX_OPACITY,
      dotGridLightAngle: DEFAULT_DOT_GRID_LIGHT_ANGLE,
      dotGridRelief: DEFAULT_DOT_GRID_RELIEF,
      dotGridDotRadius: DEFAULT_DOT_GRID_DOT_RADIUS,
      dotGridFormStrength: DEFAULT_DOT_GRID_FORM_STRENGTH,
      dotGridUniformIllumination: DEFAULT_DOT_GRID_UNIFORM_ILLUMINATION,
      dotGridUniformOpacity: DEFAULT_DOT_GRID_UNIFORM_OPACITY,

      setCodeBlockThemeLight: (theme) => set({ codeBlockThemeLight: theme }),
      setCodeBlockThemeDark: (theme) => set({ codeBlockThemeDark: theme }),
      setNoteEditorBackgroundBlurAmount: (amount) =>
        set({
          noteEditorBackgroundBlurAmount: clamp(
            amount,
            0,
            MAX_NOTE_EDITOR_BLUR_AMOUNT,
          ),
        }),

      setDotGridEnabled: (enabled) => set({ dotGridEnabled: enabled }),
      setDotGridAlgorithm: (algorithm) => {
        if (isDotGridAlgorithm(algorithm)) {
          set({ dotGridAlgorithm: algorithm });
        }
      },
      setDotGridSpacing: (spacing) =>
        set({
          dotGridSpacing: clamp(
            spacing,
            MIN_DOT_GRID_SPACING,
            MAX_DOT_GRID_SPACING,
          ),
        }),
      setDotGridIlluminationRange: (min, max) => {
        // Sort here instead of clamping one slider against the other: the
        // UI uses a single two-thumb slider, so the thumbs must stay on a
        // fixed track and never drag each other around.
        const first = clamp(min, MIN_DOT_GRID_OPACITY, MAX_DOT_GRID_OPACITY);
        const second = clamp(max, MIN_DOT_GRID_OPACITY, MAX_DOT_GRID_OPACITY);
        set({
          dotGridMinOpacity: Math.min(first, second),
          dotGridMaxOpacity: Math.max(first, second),
        });
      },
      setDotGridUniformIllumination: (uniform) =>
        set({ dotGridUniformIllumination: uniform }),
      setDotGridUniformOpacity: (opacity) =>
        set({
          dotGridUniformOpacity: clamp(
            opacity,
            MIN_DOT_GRID_OPACITY,
            MAX_DOT_GRID_OPACITY,
          ),
        }),
      setDotGridLightAngle: (angle) =>
        set({ dotGridLightAngle: normalizeAngle(angle) }),
      setDotGridRelief: (relief) =>
        set({
          dotGridRelief: clamp(relief, MIN_DOT_GRID_RELIEF, MAX_DOT_GRID_RELIEF),
        }),
      setDotGridDotRadius: (radius) =>
        set({
          dotGridDotRadius: clamp(
            radius,
            MIN_DOT_GRID_DOT_RADIUS,
            MAX_DOT_GRID_DOT_RADIUS,
          ),
        }),
      setDotGridFormStrength: (strength) =>
        set({
          dotGridFormStrength: clamp(
            strength,
            MIN_DOT_GRID_FORM_STRENGTH,
            MAX_DOT_GRID_FORM_STRENGTH,
          ),
        }),
      resetDotGridSettings: () =>
        set({
          dotGridEnabled: DEFAULT_DOT_GRID_ENABLED,
          dotGridAlgorithm: DEFAULT_DOT_GRID_ALGORITHM,
          dotGridSpacing: DEFAULT_DOT_GRID_SPACING,
          dotGridMinOpacity: DEFAULT_DOT_GRID_MIN_OPACITY,
          dotGridMaxOpacity: DEFAULT_DOT_GRID_MAX_OPACITY,
          dotGridLightAngle: DEFAULT_DOT_GRID_LIGHT_ANGLE,
          dotGridRelief: DEFAULT_DOT_GRID_RELIEF,
          dotGridDotRadius: DEFAULT_DOT_GRID_DOT_RADIUS,
          dotGridFormStrength: DEFAULT_DOT_GRID_FORM_STRENGTH,
          dotGridUniformIllumination: DEFAULT_DOT_GRID_UNIFORM_ILLUMINATION,
          dotGridUniformOpacity: DEFAULT_DOT_GRID_UNIFORM_OPACITY,
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
        dotGridEnabled: state.dotGridEnabled,
        dotGridAlgorithm: state.dotGridAlgorithm,
        dotGridSpacing: state.dotGridSpacing,
        dotGridMinOpacity: state.dotGridMinOpacity,
        dotGridMaxOpacity: state.dotGridMaxOpacity,
        dotGridLightAngle: state.dotGridLightAngle,
        dotGridRelief: state.dotGridRelief,
        dotGridDotRadius: state.dotGridDotRadius,
        dotGridFormStrength: state.dotGridFormStrength,
        dotGridUniformIllumination: state.dotGridUniformIllumination,
        dotGridUniformOpacity: state.dotGridUniformOpacity,
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
          noteEditorBackgroundBlurAmount: numberOrDefault(
            p.noteEditorBackgroundBlurAmount,
            current.noteEditorBackgroundBlurAmount,
            0,
            MAX_NOTE_EDITOR_BLUR_AMOUNT,
          ),
          dotGridEnabled:
            typeof p.dotGridEnabled === "boolean"
              ? p.dotGridEnabled
              : current.dotGridEnabled,
          dotGridAlgorithm: isDotGridAlgorithm(p.dotGridAlgorithm)
            ? p.dotGridAlgorithm
            : current.dotGridAlgorithm,
          dotGridSpacing: numberOrDefault(
            p.dotGridSpacing,
            current.dotGridSpacing,
            MIN_DOT_GRID_SPACING,
            MAX_DOT_GRID_SPACING,
          ),
          dotGridMinOpacity: Math.min(
            numberOrDefault(
              p.dotGridMinOpacity,
              current.dotGridMinOpacity,
              MIN_DOT_GRID_OPACITY,
              MAX_DOT_GRID_OPACITY,
            ),
            numberOrDefault(
              p.dotGridMaxOpacity,
              current.dotGridMaxOpacity,
              MIN_DOT_GRID_OPACITY,
              MAX_DOT_GRID_OPACITY,
            ),
          ),
          dotGridMaxOpacity: Math.max(
            numberOrDefault(
              p.dotGridMinOpacity,
              current.dotGridMinOpacity,
              MIN_DOT_GRID_OPACITY,
              MAX_DOT_GRID_OPACITY,
            ),
            numberOrDefault(
              p.dotGridMaxOpacity,
              current.dotGridMaxOpacity,
              MIN_DOT_GRID_OPACITY,
              MAX_DOT_GRID_OPACITY,
            ),
          ),
          dotGridLightAngle: numberOrDefault(
            p.dotGridLightAngle,
            current.dotGridLightAngle,
            0,
            360,
          ),
          dotGridRelief: numberOrDefault(
            p.dotGridRelief,
            current.dotGridRelief,
            MIN_DOT_GRID_RELIEF,
            MAX_DOT_GRID_RELIEF,
          ),
          dotGridDotRadius: numberOrDefault(
            p.dotGridDotRadius,
            current.dotGridDotRadius,
            MIN_DOT_GRID_DOT_RADIUS,
            MAX_DOT_GRID_DOT_RADIUS,
          ),
          dotGridFormStrength: numberOrDefault(
            p.dotGridFormStrength,
            current.dotGridFormStrength,
            MIN_DOT_GRID_FORM_STRENGTH,
            MAX_DOT_GRID_FORM_STRENGTH,
          ),
          dotGridUniformIllumination:
            typeof p.dotGridUniformIllumination === "boolean"
              ? p.dotGridUniformIllumination
              : current.dotGridUniformIllumination,
          dotGridUniformOpacity: numberOrDefault(
            p.dotGridUniformOpacity,
            current.dotGridUniformOpacity,
            MIN_DOT_GRID_OPACITY,
            MAX_DOT_GRID_OPACITY,
          ),
        };
      },
    },
  ),
);
