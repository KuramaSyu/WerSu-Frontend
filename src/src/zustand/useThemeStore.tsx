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
import type { ThemePreference } from "../models/Preferences";

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
  /** Owner the theme is (or will be) published to, when known. */
  scope?: "user" | "shelf";
  /** Id of the user/shelf the theme is published to (with `scope`). */
  targetId?: string;
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
   * When `true`, cloud `/api/preferences` theme changes are ignored and
   * must NOT replace the theme chosen on this device (the "device
   * override"). Toggled by the pin button next to the theme picker in
   * `UserMenu`. Persisted so the pin survives reloads.
   */
  themeLocked: boolean;

  /** Pin/unpin this device's theme against cloud preference changes. */
  setThemeLocked: (locked: boolean) => void;

  /**
   * `true` once the user has explicitly chosen a theme. A shelf's theme
   * is only offered while this is `false` ("if he hasn't selected one
   * himself"). Persisted so the choice survives reloads.
   */
  themeUserSelected: boolean;

  /** Record that the current theme is an explicit user choice. */
  markThemeUserSelected: () => void;

  /**
   * A cloud preference whose theme has not been registered yet (e.g. a
   * synced custom theme still loading from its own preference row). It is
   * parked here instead of silently falling back to the default theme, and
   * retried once `registerSyncedThemes` makes the theme available. Not
   * persisted.
   */
  pendingThemePreference: ThemePreference | null;

  /**
   * Explicit, user-initiated theme pick. Applies the theme and flips
   * `themeUserSelected` so the shelf fallback stops overriding it.
   */
  selectTheme: (themeName: string) => Promise<void>;

  /**
   * Themes loaded from a `custom-themes` preferences row (the user's own
   * or the active shelf's). Registered with the `ThemeManager` so a synced
   * theme name resolves on this device, but kept separate from
   * `generatedThemes` so they are never re-uploaded accidentally.
   */
  syncedThemes: GeneratedThemeRecord[];

  /** Ids currently contributed by each synced preference row. */
  syncedThemeIdsBySource: Record<string, string[]>;

  /**
   * Replace the themes sourced from one preference row. `sourceKey`
   * identifies the row (e.g. `user:<id>` / `shelf:<id>`); themes from a
   * previous value for the same source that are no longer present are
   * unregistered (unless a local generated theme still uses the id).
   */
  registerSyncedThemes: (
    sourceKey: string,
    records: GeneratedThemeRecord[],
  ) => void;  

  /**
   * Apply a cloud theme preference, unless this device's theme is pinned
   * (`themeLocked`). Manual `setTheme` calls always win immediately; this
   * method only runs for changes coming from the preferences blob.
   *
   * Pass `{ force: true }` for an explicit user-initiated download, which
   * must apply even when the device theme is pinned.
   */
  applyThemePreference: (
    preference: ThemePreference,
    options?: { force?: boolean },
  ) => Promise<void>;

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

/**
 * Resolve a cloud `ThemePreference` to a concrete theme-name slug.
 *
 * `mode: "system"` follows the OS `prefers-color-scheme` setting; the
 * matching `light`/`dark` slot supplies the theme name. Returns `null`
 * when that slot is unset (callers then keep the current theme).
 */
function resolveThemePreference(preference: ThemePreference): string | null {
  let mode = preference.mode;
  if (mode === "system") {
    const prefersDark =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    mode = prefersDark ? "dark" : "light";
  }
  return mode === "light" ? preference.light : preference.dark;
}

/**
 * Apply a parked cloud preference once its theme has been registered and the
 * device is not pinned. No-op while the theme is still missing, so it is safe
 * to call after every registration pass.
 */
function applyPendingThemePreference(
  get: () => ThemeState,
  set: (partial: Partial<ThemeState>) => void,
): void {
  const { pendingThemePreference, themeLocked } = get();
  if (pendingThemePreference === null || themeLocked) {
    return;
  }
  const themeName = resolveThemePreference(pendingThemePreference);
  if (themeName === null || !themeManager.hasTheme(themeName)) {
    return;
  }
  set({ pendingThemePreference: null });
  void get().setTheme(themeName);
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
      themeLocked: false,
      themeUserSelected: false,
      syncedThemes: [],
      syncedThemeIdsBySource: {},
      pendingThemePreference: null,

      setThemeLocked: (locked: boolean) => {
        set({ themeLocked: locked });
        // Unpinning lets a parked cloud preference take effect again.
        if (!locked) {
          applyPendingThemePreference(get, set);
        }
      },

      markThemeUserSelected: () => {
        if (!get().themeUserSelected) {
          set({ themeUserSelected: true });
        }
      },

      selectTheme: async (themeName: string) => {
        // An explicit pick wins over a parked cloud preference.
        set({ themeUserSelected: true, pendingThemePreference: null });
        await get().setTheme(themeName);
      },

      registerSyncedThemes: (sourceKey, records) => {
        const state = get();
        const previousIds = new Set(
          state.syncedThemeIdsBySource[sourceKey] ?? [],
        );
        const nextIds = new Set(records.map((r) => r.id));

        // Patches that survived from this source, plus the new ones.
        const byId = new Map(state.syncedThemes.map((r) => [r.id, r]));
        for (const record of records) {
          // Don't clobber a local generated theme with the same id.
          if (!state.generatedThemes.some((r) => r.id === record.id)) {
            byId.set(record.id, record);
            themeManager.registerTheme(buildThemeFromImageRecord(record));
          }
        }

        // Themes that this source no longer contains. Remove them only if
        // no other source references them and no local theme owns the id.
        const otherSourceIds = new Set(
          Object.entries(state.syncedThemeIdsBySource)
            .filter(([key]) => key !== sourceKey)
            .flatMap(([, ids]) => ids),
        );
        for (const id of previousIds) {
          if (nextIds.has(id) || otherSourceIds.has(id)) {
            continue;
          }
          if (state.generatedThemes.some((r) => r.id === id)) {
            continue;
          }
          const record = byId.get(id);
          if (record !== undefined) {
            themeManager.removeTheme(record.name);
            byId.delete(id);
          }
        }

        set({
          syncedThemes: [...byId.values()],
          syncedThemeIdsBySource: {
            ...state.syncedThemeIdsBySource,
            [sourceKey]: [...nextIds],
          },
          customThemes: themeManager.getAllThemes(),
        });

        // A cloud preference that referenced one of the themes we just
        // registered can now be applied.
        applyPendingThemePreference(get, set);
      },

      applyThemePreference: async (
        preference: ThemePreference,
        options?: { force?: boolean },
      ) => {
        // A pinned device theme ignores incoming cloud preference changes,
        // unless this is an explicit download (`force`).
        if (get().themeLocked && options?.force !== true) {
          return;
        }
        const themeName = resolveThemePreference(preference);
        if (themeName === null) {
          return;
        }
        // Synced custom themes are loaded from a separate preference row and
        // may not be registered yet. Park the preference and let
        // `registerSyncedThemes` retry; `generateTheme` would otherwise
        // silently resolve the unknown name to the default theme.
        if (!themeManager.hasTheme(themeName)) {
          set({ pendingThemePreference: preference });
          return;
        }
        set({ pendingThemePreference: null });
        await get().setTheme(themeName);
      },

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
        const scope = input.scope;
        const targetId = input.targetId;
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
          ...(scope !== undefined ? { scope } : {}),
          ...(targetId !== undefined ? { targetId } : {}),
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
        themeLocked: state.themeLocked,
        themeUserSelected: state.themeUserSelected,
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
          themeLocked:
            typeof p.themeLocked === "boolean"
              ? p.themeLocked
              : current.themeLocked,
          themeUserSelected:
            typeof p.themeUserSelected === "boolean"
              ? p.themeUserSelected
              : current.themeUserSelected,
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
