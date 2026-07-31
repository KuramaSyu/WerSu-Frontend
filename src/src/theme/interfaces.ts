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
    /**
     * Contrast color tuned for the AppBar surface, which differs per
     * mode (light = `primary.main`, dark = `background.paper` + overlay).
     * Use this for icons/text that sit on the AppBar without relying on
     * CSS inheritance — matches what `IconButton color="inherit"` would
     * resolve to for the bar.
     */
    contrast: string;
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
    contrast?: string;
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
