import "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    vibrant: {
      main: string;
      light: string;
      dark: string;
    };
    muted: {
      main: string;
      light: string;
      dark: string;
    };
    surfaces: {
      /**
       * Background of the side rails (left + right). Tuned to sit between
       * `background.default` (canvas) and `background.paper` (cards,
       * dialogs, menus) so rails recede behind foreground content.
       */
      panel: string;
    };
  }

  interface PaletteOptions {
    vibrant?: {
      main: string;
      light: string;
      dark: string;
    };
    muted?: {
      main: string;
      light: string;
      dark: string;
    };
    surfaces?: {
      panel?: string;
    };
  }

  interface Theme {
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
