import { createTheme } from '@mui/material/styles';
import type { CustomThemeConfig, CustomTheme } from '../theme/customTheme';
import {
  docsTheme,
  customThemes,
  useThemeStore,
} from '../zustand/useThemeStore';
import useInfoStore, { SnackbarUpdateImpl } from '../zustand/InfoStore';
import { defaultTheme } from '../zustand/defaultTheme';
import "@fontsource/open-sans/300.css";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/600.css";
import "@fontsource/open-sans/700.css";

// Augment MUI's Theme to include extra custom properties.
declare module '@mui/material/styles' {
  interface Theme {
    palette: Palette;
    custom: {
      backgroundImage: string;
      themeName: string;
      longName: string;
    };
  }
  interface ThemeOptions {
    custom?: {
      backgroundImage?: string;
      themeName?: string;
      longName?: string;
    };
  }
}

export function buildCustomTheme(
  primaryMain: string,
  lightVibrantHex: string,
  darkVibrantHex: string,
  secondaryMain: string,
  lightMutedHex: string,
  darkMutedHex: string,
  vibrantHex: string,
  mutedHex: string,
  chosenBackground: string,
  config: { name: string; longName: string },
  isDark: boolean
): CustomTheme {
  return createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light',
      primary: {
        main: primaryMain,
        light: lightVibrantHex,
        dark: darkVibrantHex,
      },
      secondary: {
        main: secondaryMain,
        light: lightMutedHex,
        dark: darkMutedHex,
      },
      // Extra vibrant palette values
      vibrant: {
        main: vibrantHex,
        light: lightVibrantHex,
        dark: darkVibrantHex,
      },
      // Extra muted palette values
      muted: {
        main: mutedHex,
        light: lightMutedHex,
        dark: darkMutedHex,
      },
    },
    custom: {
      backgroundImage: chosenBackground,
      themeName: config.name,
      longName: config.longName,
    },
  }) as CustomTheme;
}

// Helper function that selects the correct color based on mode.
// const autoSelect = (light: string, dark: string, isDark: boolean) =>
//   isDark ? dark : light;
export class ThemeManager {
  private themes: Map<string, CustomThemeConfig>;
  private static instance: ThemeManager | undefined;
  // For now, we use a constant to choose dark mode; later this can be dynamically set.
  private readonly isDark: boolean = true;

  private constructor(configs: CustomThemeConfig[]) {
    this.themes = new Map();
    configs.forEach((config) => this.themes.set(config.name, config));
  }

  public static getInstance(): ThemeManager {
    if (ThemeManager.instance === undefined) {
      ThemeManager.instance = new ThemeManager(customThemes);
    }
    return ThemeManager.instance;
  }

  public getThemeSync(themeName: string): CustomTheme | null {
    let theme;
    switch (themeName) {
      case 'docsTheme':
        theme = docsTheme;
        break;
      case 'default':
        theme = defaultTheme;
        break;
      default:
        theme = defaultTheme;
    }
    return createTheme({
      ...theme,
      ...themechanges
    })
  };

  /**
   * Asynchronously generates an MUI theme.
   * Always runs Vibrant on the randomly chosen background.
   * If config.primary/secondary are provided, they override Vibrant's primary result.
   * The full extracted palette is used to populate primary, secondary, and extra palette keys.
   */
  public async generateTheme(themeName: string): Promise<CustomTheme | null> {
    const background = useThemeStore.getState().theme.custom.backgroundImage;
    let theme;
    switch (themeName) {
      case 'docsTheme':
        theme = docsTheme;
        break;
      case 'default':
        theme = defaultTheme;
        break;
      default:
        theme = defaultTheme;
    }
    return createTheme({
      ...theme,
      ...themechanges
    })
}
}

const themechanges = {
        typography: {
        fontFamily: "Open Sans",
      },
      components: {
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              borderRadius: "4rem",
            },
            input: {
              padding: "0.5rem 0.5rem",
              fontSize: "1.5rem",
            },
          },
        },
      }
}