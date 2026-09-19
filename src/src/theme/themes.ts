import { createTheme, type Theme } from "@mui/material";
import { CustomThemeImpl, type CustomTheme } from "./customTheme";

// Define a Nord-themed default theme as a fallback.
export const defaultTheme = createTheme({
  // https://www.nordtheme.com/

  // colorSchemes: { light: true, dark: true },
  palette: {
    mode: "dark",
    // primary: { main: "#5E81AC", light: "#81A1C1", dark: "#4C688A" }, // Nord10, Nord9
    primary: { main: "#88c0d0" },
    secondary: { main: "#b48ead" }, // Nord15
    vibrant: { main: "#b48ead", light: "#ebcb8b", dark: "#bf616a" }, // Nord8, Nord7
    muted: { main: "#434c5e", light: "#4c566a", dark: "#3B4252" }, // Nord1, 2, 3
    text: { primary: "#eceff4", secondary: "#d8dee9" },
    background: {
      default: "#2E3440", // Nord0
      paper: "#3B4252", // Nord1
    },

    warning: { main: "#d08770", light: "#ebcb8b", dark: "#bf616a" }, // Nord14, Nord7, Nord13
    error: { main: "#bf616a", light: "#d08770", dark: "#a54242" }, // Nord13, Nord14, custom dark
    success: { main: "#5e81ac", light: "#8fbcbb", dark: "#4c688a" }, // Nord10, Nord7, Nord9
  },
  custom: {
    backgroundImage: "https://i.postimg.cc/prhxrMh8/thumb-1920-553471.jpg",
    themeName: "default",
    longName: "Nord Theme Dark",
  },
}) as CustomTheme;

export const docsTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#5E81AC", light: "#81A1C1", dark: "#4C688A" }, // Nord10, Nord9
    secondary: { main: "#B48EAD", light: "#D8DEE9", dark: "#3B4252" }, // Nord15
    vibrant: { main: "#88C0D0", light: "#8FBCBB", dark: "#5E81AC" }, // Nord8, Nord7
    muted: { main: "#eceff4", light: "#616E88", dark: "#3B4252" }, // Nord3, Nord1
    background: {
      default: "#eceff4", // Nord0
      paper: "#3B4252", // Nord1
    },

    warning: { main: "#d08770", light: "#ebcb8b", dark: "#bf616a" }, // Nord14, Nord7, Nord13
    error: { main: "#bf616a", light: "#d08770", dark: "#a54242" }, // Nord13, Nord14, custom dark
    success: { main: "#5e81ac", light: "#8fbcbb", dark: "#4c688a" }, // Nord10, Nord7, Nord9
  },
  custom: {
    backgroundImage: "https://i.postimg.cc/prhxrMh8/thumb-1920-553471.jpg",
    themeName: "docs",
    longName: "Nord Theme Bright",
  },
} as CustomTheme);

export const githubTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#0969da" },
    secondary: { main: "#077A7D" },
    vibrant: { main: "#0969da", light: "#54aeff", dark: "#0550ae" },
    muted: { main: "#eaeef2", light: "#f6f8fa", dark: "#d0d7de" },
    text: { primary: "#1f2328", secondary: "#57606a" },
    background: {
      default: "#ffffff",
      paper: "#f6f8fa",
    },

    warning: { main: "#bf8700", light: "#ffcf4d", dark: "#7a5b00" },
    error: { main: "#cf222e", light: "#ff8182", dark: "#a40e26" },
    success: { main: "#1f883d", light: "#3fb950", dark: "#116329" },
  },
  custom: {
    backgroundImage: "https://i.postimg.cc/prhxrMh8/thumb-1920-553471.jpg",
    themeName: "github",
    longName: "GitHub Light",
  },
} as CustomTheme);

export const githubDarkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#58a6ff" },
    secondary: { main: "#077A7D" },
    vibrant: { main: "#58a6ff", light: "#79c0ff", dark: "#1f6feb" },
    muted: { main: "#21262d", light: "#30363d", dark: "#161b22" },
    text: { primary: "#e6edf3", secondary: "#8b949e" },
    background: {
      default: "#0d1117",
      paper: "#0d1117",
    },

    warning: { main: "#d29922", light: "#e3b341", dark: "#bb8009" },
    error: { main: "#f85149", light: "#ff7b72", dark: "#da3633" },
    success: { main: "#2ea043", light: "#3fb950", dark: "#238636" },
  },
  custom: {
    backgroundImage: "https://i.postimg.cc/prhxrMh8/thumb-1920-553471.jpg",
    themeName: "github-dark",
    longName: "GitHub Dark",
  },
} as CustomTheme);

export const brightTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#ff8f00" },
    secondary: { main: "#00bcd4", light: "#62efff", dark: "#008ba3" },
    vibrant: { main: "#ff4081", light: "#ff79b0", dark: "#c60055" },
    muted: { main: "#ffe082", light: "#fff7b2", dark: "#caae53" },
    text: { primary: "#1f2328", secondary: "#4f5b66" },
    background: {
      default: "#fffdf7",
      paper: "#fff3e0",
    },

    warning: { main: "#f57c00", light: "#ffad42", dark: "#bb4d00" },
    error: { main: "#d32f2f", light: "#ff6659", dark: "#9a0007" },
    success: { main: "#2e7d32", light: "#60ad5e", dark: "#005005" },
  },
  custom: {
    backgroundImage: "https://i.postimg.cc/prhxrMh8/thumb-1920-553471.jpg",
    themeName: "bright",
    longName: "Bright Theme",
  },
} as CustomTheme);

export const midnightTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#60a5fa" },
    secondary: { main: "#38bdf8" },
    vibrant: { main: "#22d3ee", light: "#67e8f9", dark: "#06b6d4" },
    muted: { main: "#1f2a44", light: "#24324f", dark: "#182136" },
    text: { primary: "#e2e8f0", secondary: "#94a3b8" },
    background: {
      default: "#0b1526",
      paper: "#111c33",
    },
    surfaces: {
      // Midway between canvas and cards.
      panel: "#0E1829",
    },
    warning: { main: "#f59e0b", light: "#fbbf24", dark: "#b45309" },
    error: { main: "#f87171", light: "#fca5a5", dark: "#ef4444" },
    success: { main: "#34d399", light: "#6ee7b7", dark: "#10b981" },
  },
  custom: {
    backgroundImage: "https://i.postimg.cc/prhxrMh8/thumb-1920-553471.jpg",
    themeName: "midnight",
    longName: "Midnight Blue",
  },
} as CustomTheme);

export const everforestHardDark = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#a7c080" },
    secondary: { main: "#e69875" },
    text: { primary: "#d3c6aa", secondary: "#9E9580" },
    background: {
      default: "#232a2e",
      paper: "#2d353b",
    },
    error: { main: "#e67e80", dark: "#514054" },
    warning: { main: "#dbbc7f", dark: "#4d4c43" },
    success: { main: "#a7c080", dark: "#425047" },
  },
  custom: {
    backgroundImage: "https://i.postimg.cc/prhxrMh8/thumb-1920-553471.jpg",
    themeName: "everforest-hard-dark",
    longName: "Everforest Dark",
  },
} as CustomTheme);

export const everforestSoftLight = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#8DA101" }, // green
    secondary: { main: "#3A94C5" }, // blue
    vibrant: { main: "#DF69BA", light: "#F1DDD4", dark: "#B85A9E" }, // purple / bg_purple
    muted: { main: "#E5DFC5", light: "#F3EAD3", dark: "#DDD8BE" }, // bg2 / bg0 / bg3
    text: { primary: "#5C6A72", secondary: "#829181" }, // fg / grey2
    background: {
      default: "#F3EAD3", // bg0
      paper: "#EAE4CA", // bg1
    },
    error: { main: "#F85552", light: "#E66868", dark: "#C44340" }, // red / statusline3
    warning: { main: "#DFA000", light: "#F1E4C5", dark: "#B58A00" }, // yellow / bg_yellow
    success: { main: "#8DA101", light: "#93B259", dark: "#6F8400" }, // green / statusline1
  },
  custom: {
    backgroundImage: "https://i.postimg.cc/prhxrMh8/thumb-1920-553471.jpg",
    themeName: "everforest-soft-light",
    longName: "Everforest Soft Light",
  },
} as CustomTheme);

export const customThemes = [
  new CustomThemeImpl(
    createTheme({
      palette: {
        mode: "dark",
      },
    }),
    {
      themeName: "material-mark",
      longName: "Material Mark",
      backgroundImage: "",
    },
  ),
  new CustomThemeImpl(githubDarkTheme),
  new CustomThemeImpl(githubTheme),
  new CustomThemeImpl(midnightTheme),
  new CustomThemeImpl(defaultTheme),
  new CustomThemeImpl(everforestHardDark),
  new CustomThemeImpl(everforestSoftLight),
];
