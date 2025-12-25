import { create } from 'zustand';
import { createTheme } from '@mui/material/styles';
import { ThemeManager } from '../theme/themeManager';
import type { CustomTheme, CustomThemeConfig } from '../theme/customTheme';
import customThemeData from '../theme/themes.json';
import usePreferenceStore from './PreferenceStore';
import { loadPreferencesFromCookie } from '../utils/cookiePreferences';
import { defaultTheme } from './defaultTheme';

export const docsTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#5E81AC', light: '#81A1C1', dark: '#4C688A' }, // Nord10, Nord9
    secondary: { main: '#B48EAD', light: '#D8DEE9', dark: '#3B4252' }, // Nord15
    vibrant: { main: '#88C0D0', light: '#8FBCBB', dark: '#5E81AC' }, // Nord8, Nord7
    muted: { main: '#eceff4', light: '#616E88', dark: '#3B4252' }, // Nord3, Nord1
    background: {
      default: '#eceff4', // Nord0
      paper: '#3B4252', // Nord1
    },
    warning: { main: '#d08770', light: '#ebcb8b', dark: '#bf616a' }, // Nord14, Nord7, Nord13
    error: { main: '#bf616a', light: '#d08770', dark: '#a54242' }, // Nord13, Nord14, custom dark
    success: { main: '#5e81ac', light: '#8fbcbb', dark: '#4c688a' }, // Nord10, Nord7, Nord9
  },
  custom: {
    backgroundImage: 'https://i.postimg.cc/prhxrMh8/thumb-1920-553471.jpg',
    themeName: 'docs',
    longName: 'Nord Theme Bright',
  },
} as CustomTheme);

// Define our available custom themes.
export const customThemes: CustomThemeConfig[] = customThemeData;

export const getThemeNames = () => {
  return customThemes.map((theme) => theme.name);
};

// Instantiate our ThemeManager with the custom configurations.
const themeManager = ThemeManager.getInstance();

interface ThemeState {
  theme: CustomTheme;
  themeName: string;
  themeLongName: string;

  /**
   * setTheme accepts a theme string, asynchronously generates the MUI theme (including Vibrant extraction),
   * and updates the store with the theme and its names.
   * static themes: 'docsTheme', 'default'
   */
  setTheme: (themeName: string) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: ThemeManager.getInstance().getThemeSync('default') || defaultTheme,
  themeName: defaultTheme.custom.themeName,
  themeLongName: defaultTheme.custom.longName,

  init: async () => {
      const initialThemeName = 'default'; 
      await get().setTheme(initialThemeName);
    },
    
  setTheme: async (themeName: string) => {
    console.log(`set theme to ${themeName}`);
    //set({ themeName: themeName });
    const generatedTheme = await themeManager.generateTheme(themeName);
    if (generatedTheme) {
      set({
        theme: generatedTheme,
        themeName: generatedTheme.custom.themeName,
        themeLongName: generatedTheme.custom.longName,
      });
    } else {
      console.error(`Unable to generate theme for "${themeName}".`);
    }
  },
}));