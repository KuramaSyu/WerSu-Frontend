import { create } from "zustand";
import { createTheme } from "@mui/material/styles";
import { ThemeManager } from "../theme/themeManager";
import {
  CustomThemeImpl,
  type CustomTheme,
  type CustomThemeConfig,
} from "../theme/customTheme";
import { loadPreferencesFromCookie } from "../utils/cookiePreferences";
import { persist } from "zustand/middleware";
import { defaultTheme } from "../theme/themes";

// Instantiate our ThemeManager with the custom configurations.
const themeManager = ThemeManager.getInstance();

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

  /**
   * setTheme accepts a theme string, asynchronously generates the MUI theme (including Vibrant extraction),
   * and updates the store with the theme and its names.
   * static themes: 'docsTheme', 'default'
   */
  setTheme: (themeName: string) => Promise<void>;
  customThemes: CustomTheme[];
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

      // init: async () => {
      //   const initialThemeName = "default";
      //   await get().setTheme(initialThemeName);
      // },

      setTheme: async (themeName: string) => {
        console.log(`set theme to ${themeName}`);
        //set({ themeName: themeName });
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
      customThemes: [...themeManager.themes.values()],
    }),
    {
      name: "theme-storage", // name of the item in storage (must be unique)
      partialize: (state) => ({
        themeName: state.themeName,
        lastLightTheme: state.lastLightTheme,
        lastDarkTheme: state.lastDarkTheme,
      }),

      onRehydrateStorage: () => async (state) => {
        if (!state?.themeName) return;

        const theme = await themeManager.generateTheme(state.themeName);
        state.theme = new CustomThemeImpl(theme ?? defaultTheme, undefined, {
          recalculateSuccessInfoWarningErrorColors: true,
        });
      },
    },
  ),
);
