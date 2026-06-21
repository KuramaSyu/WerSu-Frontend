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

      // init: async () => {
      //   const initialThemeName = "default";
      //   await get().setTheme(initialThemeName);
      // },

      setTheme: async (themeName: string) => {
        console.log(`set theme to ${themeName}`);
        //set({ themeName: themeName });
        const generatedTheme = await themeManager.generateTheme(themeName);
        if (generatedTheme) {
          set({
            theme: new CustomThemeImpl(generatedTheme, undefined, {
              recalculateSuccessInfoWarningErrorColors: true,
            }),
            themeName: generatedTheme.custom.themeName,
            themeLongName: generatedTheme.custom.longName,
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
