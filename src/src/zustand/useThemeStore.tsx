import { create } from "zustand";
import { ThemeManager } from "../theme/themeManager";
import { CustomThemeImpl, type CustomTheme } from "../theme/customTheme";
import { persist } from "zustand/middleware";
import { defaultTheme } from "../theme/themes";
import {
  buildThemeFromImageRecord,
  clampThemeName,
  isGeneratedThemeRecord,
  normalizeGeneratedThemeRecord,
  type GeneratedThemeRecord,
  type ImageThemePalette,
  type ThemeMode,
} from "../theme/imageTheme";
import { useImageBlobCacheStore } from "./useImageBlobCache";
import { slugify } from "../utils/slugify";

// Instantiate our ThemeManager with the custom configurations.
const themeManager = ThemeManager.getInstance();

export interface AddGeneratedThemeInput {
  /** User-facing name; slugified into the theme's short identifier. */
  longName: string;
  /** A palette per mode, so one image yields a dark and a light theme. */
  palettes: Record<ThemeMode, ImageThemePalette>;
  /** Remote URL or `local:<id>` blob-cache key for the source image. */
  backgroundImage: string;
  /** `local:<id>` blob-cache key for the pre-rendered blurred variant. */
  blurredBackgroundImage: string;
  /** Background blur strength, 0-100. */
  blur: number;
}

/** The dark + light records generated from a single image. */
export interface GeneratedThemePair {
  dark: GeneratedThemeRecord;
  light: GeneratedThemeRecord;
}

interface ThemeState {
  theme: CustomThemeImpl;
  themeName: string;
  themeLongName: string;
  // Last theme of each mode the user activated. The light/dark
  // toggle in UserMenu reads these so flipping back restores the
  // last theme the user had on for that mode instead of jumping
  // to the first theme in the catalog. `null` means the user
  // hasn't picked a theme of that mode yet on this device.
  lastLightTheme: string | null;
  lastDarkTheme: string | null;

  // Themes generated from uploaded images. Persisted as plain records
  // and rebuilt into MUI themes on rehydration.
  generatedThemes: GeneratedThemeRecord[];

  /**
   * setTheme accepts a theme string, resolves the MUI theme (including
   * any registered generated theme), and updates the store with the
   * theme and its names.
   */
  setTheme: (themeName: string) => Promise<void>;
  customThemes: CustomTheme[];

  /** Build, register and persist a generated dark+light pair. */
  addGeneratedTheme: (input: AddGeneratedThemeInput) => GeneratedThemePair;
  /** Update a generated theme's name, palette and/or background blur. */
  updateGeneratedTheme: (
    id: string,
    patch: {
      longName?: string;
      palette?: ImageThemePalette;
      blurredBackgroundImage?: string;
      blur?: number;
    },
  ) => void;
  /** Remove a generated theme and fall back to the default when active. */
  removeGeneratedTheme: (id: string) => void;
  /** Remove every generated theme. */
  clearGeneratedThemes: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: new CustomThemeImpl(
        ThemeManager.getInstance().getThemeSync("default") || defaultTheme,
        undefined,
        { recalculateSuccessInfoWarningErrorColors: true },
      ),
      themeName: defaultTheme.custom.themeName,
      themeLongName: defaultTheme.custom.longName,
      lastLightTheme: null,
      lastDarkTheme: null,
      generatedThemes: [],

      setTheme: async (themeName: string) => {
        console.log(`set theme to ${themeName}`);
        const generatedTheme = await themeManager.generateTheme(themeName);
        if (generatedTheme) {
          // Record the last theme activated per mode so the
          // light/dark toggle in UserMenu can flip back to it.
          // Only update the slot that matches the new theme's
          // mode -- toggling to dark must NOT overwrite the
          // last-used light theme the user is about to flip
          // back to.
          const newMode =
            generatedTheme.palette.mode === "light" ? "light" : "dark";
          const lastSlotPatch: Partial<ThemeState> =
            newMode === "light"
              ? { lastLightTheme: generatedTheme.custom.themeName }
              : { lastDarkTheme: generatedTheme.custom.themeName };

          set({
            theme: new CustomThemeImpl(generatedTheme, undefined, {
              recalculateSuccessInfoWarningErrorColors: true,
            }),
            themeName: generatedTheme.custom.themeName,
            themeLongName: generatedTheme.custom.longName,
            ...lastSlotPatch,
          });
        } else {
          console.error(`Unable to generate theme for "${themeName}".`);
        }
      },

      addGeneratedTheme: (input) => {
        const longName = clampThemeName(input.longName);
        const baseName = slugify(longName);
        // A group owns two theme names (`<group>-dark` / `<group>-light`).
        let group = baseName;
        let suffix = 2;
        const nameTaken = (candidate: string) =>
          themeManager.hasTheme(`${candidate}-dark`) ||
          themeManager.hasTheme(`${candidate}-light`);
        while (nameTaken(group)) {
          group = `${baseName}-${suffix}`;
          suffix += 1;
        }

        const makeRecord = (mode: ThemeMode): GeneratedThemeRecord => ({
          id: `gen-${mode}-${Date.now().toString(36)}-${Math.floor(
            Math.random() * 1_000_000,
          ).toString(36)}`,
          groupId: group,
          name: `${group}-${mode}`,
          longName,
          mode,
          palette: input.palettes[mode],
          backgroundImage: input.backgroundImage,
          blurredBackgroundImage: input.blurredBackgroundImage,
          blur: input.blur,
          createdAt: Date.now(),
        });

        const dark = makeRecord("dark");
        const light = makeRecord("light");
        const darkTheme = buildThemeFromImageRecord(dark);
        const lightTheme = buildThemeFromImageRecord(light);
        themeManager.registerTheme(darkTheme);
        themeManager.registerTheme(lightTheme);
        set((state) => ({
          generatedThemes: [...state.generatedThemes, dark, light],
          customThemes: [...state.customThemes, darkTheme, lightTheme],
        }));
        return { dark, light };
      },

      updateGeneratedTheme: (id, patch) => {
        const record = get().generatedThemes.find((r) => r.id === id);
        if (record === undefined) {
          return;
        }
        // Name and blur are shared by the whole dark/light pair; the
        // palette edit only touches the variant the user is editing.
        const groupRecords = get().generatedThemes.filter(
          (r) => r.groupId === record.groupId,
        );
        const updatedRecords = groupRecords.map(
          (r): GeneratedThemeRecord => ({
            ...r,
            longName:
              patch.longName !== undefined
                ? clampThemeName(patch.longName) || r.longName
                : r.longName,
            palette:
              r.id === id && patch.palette !== undefined
                ? patch.palette
                : r.palette,
            blurredBackgroundImage:
              patch.blurredBackgroundImage ?? r.blurredBackgroundImage,
            blur:
              patch.blur !== undefined
                ? Math.max(0, Math.min(100, patch.blur))
                : r.blur,
          }),
        );

        const updatedById = new Map(updatedRecords.map((r) => [r.id, r]));
        const updatedThemeByName = new Map(
          updatedRecords.map((r) => [
            r.name,
            buildThemeFromImageRecord(r),
          ]),
        );
        for (const theme of updatedThemeByName.values()) {
          themeManager.registerTheme(theme);
        }

        set((state) => ({
          generatedThemes: state.generatedThemes.map(
            (r) => updatedById.get(r.id) ?? r,
          ),
          customThemes: state.customThemes.map(
            (t) => updatedThemeByName.get(t.custom.themeName) ?? t,
          ),
        }));
        // Re-apply so an active theme reflects the edit immediately.
        if (get().themeName === record.name) {
          void get().setTheme(record.name);
        }
      },

      removeGeneratedTheme: (id) => {
        const record = get().generatedThemes.find((r) => r.id === id);
        if (record === undefined) {
          return;
        }
        // A pair is one logical theme: delete both variants at once.
        const group = get().generatedThemes.filter(
          (r) => r.groupId === record.groupId,
        );
        const removeIds = new Set(group.map((r) => r.id));
        const removeNames = new Set(group.map((r) => r.name));
        for (const r of group) {
          themeManager.removeTheme(r.name);
        }

        // Only drop local blobs no remaining record still points at them.
        const remaining = get().generatedThemes.filter(
          (r) => !removeIds.has(r.id),
        );
        const sources = new Set(
          group.flatMap((r) => [r.backgroundImage, r.blurredBackgroundImage]),
        );
        for (const src of sources) {
          if (!src.startsWith("local:")) {
            continue;
          }
          const stillUsed = remaining.some(
            (r) =>
              r.backgroundImage === src || r.blurredBackgroundImage === src,
          );
          if (!stillUsed) {
            void useImageBlobCacheStore.getState().remove(src);
          }
        }

        set((state) => ({
          generatedThemes: state.generatedThemes.filter(
            (r) => !removeIds.has(r.id),
          ),
          customThemes: state.customThemes.filter(
            (t) => !removeNames.has(t.custom.themeName),
          ),
          // Clear the per-mode memory so the light/dark toggle cannot
          // try to restore a theme that no longer exists.
          lastLightTheme:
            state.lastLightTheme !== null &&
            removeNames.has(state.lastLightTheme)
              ? null
              : state.lastLightTheme,
          lastDarkTheme:
            state.lastDarkTheme !== null && removeNames.has(state.lastDarkTheme)
              ? null
              : state.lastDarkTheme,
        }));
        if (removeNames.has(get().themeName)) {
          void get().setTheme("default");
        }
      },

      clearGeneratedThemes: () => {
        const records = get().generatedThemes;
        for (const record of records) {
          themeManager.removeTheme(record.name);
          for (const src of [
            record.backgroundImage,
            record.blurredBackgroundImage,
          ]) {
            if (src.startsWith("local:")) {
              void useImageBlobCacheStore.getState().remove(src);
            }
          }
        }
        const activeName = get().themeName;
        const removedNames = new Set(records.map((r) => r.name));
        set((state) => ({
          generatedThemes: [],
          customThemes: state.customThemes.filter(
            (t) => !removedNames.has(t.custom.themeName),
          ),
          // Clear the per-mode memory so the light/dark toggle cannot
          // try to restore a theme that no longer exists.
          lastLightTheme:
            state.lastLightTheme !== null &&
            removedNames.has(state.lastLightTheme)
              ? null
              : state.lastLightTheme,
          lastDarkTheme:
            state.lastDarkTheme !== null && removedNames.has(state.lastDarkTheme)
              ? null
              : state.lastDarkTheme,
        }));
        if (records.some((r) => r.name === activeName)) {
          void get().setTheme("default");
        }
      },

      customThemes: themeManager.getAllThemes(),
    }),
    {
      name: "theme-storage", // name of the item in storage (must be unique)
      partialize: (state) => ({
        themeName: state.themeName,
        lastLightTheme: state.lastLightTheme,
        lastDarkTheme: state.lastDarkTheme,
        generatedThemes: state.generatedThemes,
      }),

      merge: (persisted, current) => {
        // Defensive: an old/foreign shape must not crash the store.
        const p = (persisted ?? {}) as Partial<ThemeState>;
        return {
          ...current,
          themeName:
            typeof p.themeName === "string" ? p.themeName : current.themeName,
          lastLightTheme:
            typeof p.lastLightTheme === "string"
              ? p.lastLightTheme
              : current.lastLightTheme,
          lastDarkTheme:
            typeof p.lastDarkTheme === "string"
              ? p.lastDarkTheme
              : current.lastDarkTheme,
          generatedThemes: Array.isArray(p.generatedThemes)
            ? p.generatedThemes
                .filter(isGeneratedThemeRecord)
                .map(normalizeGeneratedThemeRecord)
            : current.generatedThemes,
        };
      },

      onRehydrateStorage: () => async (state) => {
        if (!state) return;

        // Register generated themes before resolving the selected
        // theme so a generated theme can be restored on reload.
        for (const record of state.generatedThemes ?? []) {
          themeManager.registerTheme(buildThemeFromImageRecord(record));
        }
        // Rebuild the picker list from the registry (built-ins +
        // generated) now that every persisted theme is registered.
        state.customThemes = themeManager.getAllThemes();

        if (!state.themeName) return;

        const theme = await themeManager.generateTheme(state.themeName);
        state.theme = new CustomThemeImpl(theme ?? defaultTheme, undefined, {
          recalculateSuccessInfoWarningErrorColors: true,
        });
      },
    },
  ),
);
