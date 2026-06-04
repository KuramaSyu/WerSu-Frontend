import { createTheme, type Theme } from "@mui/material";
import { CustomThemeImpl, type CustomTheme } from "./customTheme";

// Define a Nord-themed default theme as a fallback.
export const defaultTheme = createTheme({
  // https://www.nordtheme.com/
  palette: {
    mode: "dark",
    primary: { main: "#5E81AC", light: "#81A1C1", dark: "#4C688A" }, // Nord10, Nord9
    secondary: { main: "#b48ead", light: "#D8DEE9", dark: "#3B4252" }, // Nord15
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
    primary: { main: "#0969da", light: "#2f81f7", dark: "#0757b2" },
    secondary: { main: "#57606a", light: "#8c959f", dark: "#424a53" },
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
    primary: { main: "#2f81f7", light: "#58a6ff", dark: "#1f6feb" },
    secondary: { main: "#8b949e", light: "#b1bac4", dark: "#6e7681" },
    vibrant: { main: "#58a6ff", light: "#79c0ff", dark: "#1f6feb" },
    muted: { main: "#21262d", light: "#30363d", dark: "#161b22" },
    text: { primary: "#e6edf3", secondary: "#8b949e" },
    background: {
      default: "#0d1117",
      paper: "#161b22",
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
    primary: { main: "#ff8f00", light: "#ffc046", dark: "#c56000" },
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
    primary: { main: "#60a5fa", light: "#93c5fd", dark: "#2563eb" },
    secondary: { main: "#38bdf8", light: "#7dd3fc", dark: "#0284c7" },
    vibrant: { main: "#22d3ee", light: "#67e8f9", dark: "#06b6d4" },
    muted: { main: "#1f2a44", light: "#24324f", dark: "#182136" },
    text: { primary: "#e2e8f0", secondary: "#94a3b8" },
    background: {
      default: "#0b1526",
      paper: "#111c33",
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

export const customThemes = [
  new CustomThemeImpl(
    createTheme({
      palette: {
        mode: "dark",
      },
    }),
    { themeName: "dark1", longName: "Dark 1", backgroundImage: "" },
  ),
  new CustomThemeImpl(githubDarkTheme),
  new CustomThemeImpl(githubTheme),
  new CustomThemeImpl(midnightTheme),
  new CustomThemeImpl(defaultTheme),
];
