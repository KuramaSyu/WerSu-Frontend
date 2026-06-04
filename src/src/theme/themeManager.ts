import { Vibrant } from "node-vibrant/browser";
import {
  CustomThemeImpl,
  type CustomTheme,
  type CustomThemeConfig,
} from "./customTheme";
import { createTheme } from "@mui/material";
import useInfoStore, { SnackbarUpdateImpl } from "../zustand/InfoStore";
import { useThemeStore } from "../zustand/useThemeStore";
import { customThemes, defaultTheme } from "./themes";

function isLocalOpeninaryBackground(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.protocol === "http:" &&
      parsedUrl.hostname === "localhost" &&
      parsedUrl.port === "3001"
    );
  } catch {
    return false;
  }
}

function buildPaletteRequestUrl(url: string): string {
  if (!import.meta.env.DEV || !isLocalOpeninaryBackground(url)) {
    return url;
  }

  const parsedUrl = new URL(url);
  parsedUrl.searchParams.set("_theme_cache_bust", Date.now().toString());
  return parsedUrl.toString();
}

// Augment MUI's Theme to include extra custom properties.
declare module "@mui/material/styles" {
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
  isDark: boolean,
): CustomTheme {
  return createTheme({
    palette: {
      mode: isDark ? "dark" : "light",
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
  themes: Map<string, CustomTheme>;
  private static instance: ThemeManager | undefined;
  private readonly THEME_LOADING_WARNING_TIMEOUT_MS = 4000;
  // For now, we use a constant to choose dark mode; later this can be dynamically set.
  private readonly isDark: boolean = true;

  private constructor(themes: CustomTheme[]) {
    this.themes = new Map();

    themes.forEach((t) => this.themes.set(t.custom.themeName, t));
    console.log(
      `Initialized ThemeManager with themes: ${[...this.themes.keys()].join(", ")}`,
    );
  }

  public static getInstance(): ThemeManager {
    if (ThemeManager.instance === undefined) {
      ThemeManager.instance = new ThemeManager(customThemes);
    }
    return ThemeManager.instance;
  }

  /**
   * Asynchronously generates an MUI theme.
   * Always runs Vibrant on the randomly chosen background.
   * If config.primary/secondary are provided, they override Vibrant's primary result.
   * The full extracted palette is used to populate primary, secondary, and extra palette keys.
   */
  public async generateTheme(themeName: string): Promise<CustomTheme | null> {
    return this.themes.get(themeName) ?? defaultTheme;
  }
  public getThemeSync(themeName: string): CustomTheme | null {
    return this.themes.get(themeName) ?? defaultTheme;
  }
}

//   /**
//    * Asynchronously generates an MUI theme.
//    * Always runs Vibrant on the randomly chosen background.
//    * If config.primary/secondary are provided, they override Vibrant's primary result.
//    * The full extracted palette is used to populate primary, secondary, and extra palette keys.
//    */
//   public async generateTheme(themeName: string): Promise<CustomTheme | null> {
//     // const background = useThemeStore.getState().theme.custom.backgroundImage;
//     let theme;
//     switch (themeName) {
//       case "docsTheme":
//         theme = docsTheme;
//         break;
//       case "github":
//         theme = githubTheme;
//         break;
//       case "github-dark":
//         theme = githubDarkTheme;
//         break;
//       case "bright":
//         theme = brightTheme;
//         break;
//       case "midnight":
//         theme = midnightTheme;
//         break;
//       case "default":
//         theme = defaultTheme;
//         break;
//       default:
//         theme = defaultTheme;
//     }
//     return createTheme({
//       ...theme,
//       ...themechanges,
//     });
//   }
// }

const themechanges = {
  typography: {
    fontFamily: "Open Sans",
  },

  // components: {
  //   MuiOutlinedInput: {
  //     styleOverrides: {
  //       root: {
  //         borderRadius: "4rem",
  //       },
  //       input: {
  //         padding: "0.5rem 0.5rem",
  //         //fontSize: "1.5rem",
  //       },
  //     },
  //   },
  // }
};
