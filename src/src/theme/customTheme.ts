import {
  alpha,
  lighten,
  darken,
  type Palette,
  type Theme,
  type Motion,
} from "@mui/material/styles";
import {
  blendColors,
  hexToHsl,
  hexToRgb,
  hslToHex,
  invertColor,
  rgbToHex,
} from "../utils/blendWithContrast";
import {
  themeFromSourceColor,
  argbFromHex,
  hexFromArgb,
} from "@material/material-color-utilities";
import { deepmerge } from "@mui/utils";

export type ColorInput =
  | string
  | "primary"
  | "secondary"
  | "vibrant"
  | "muted"
  | "primaryLight"
  | "primaryDark"
  | "secondaryLight"
  | "secondaryDark";

export interface CustomTheme extends Theme {
  palette: Palette & {
    poppyColors: string[]; // for multiple chip components
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
      panel: string;
    };
    contrast: string;
  };
  colorTransition: {
    root: { transition: string; "&:hover"?: { transition: string } };
  };
  custom: ThemeCustomExtension;

  /**
   * mixes the mainColor with the contrast color from the theme
   * to a specified amount. Like a dynamic brigthen() or darken()
   * depending theme.
   * @param mainColor the color to mix
   * @param theme the theme to use to get the contrast color
   * @param amount the amount to mix, 0.0 = mainColor, 1.0 = contrastColor
   * @returns the blended color in hex format
   */
  blendWithContrast(
    color: ColorInput,
    amount: number,
    useTextAsContrast: undefined | "primary" | "secondary",
  ): string;

  /**
   * mixes the mainColor with its calculated contrast color
   * to a specified amount. Like a dynamic brighten() or darken()
   * depending on the color's luminance.
   * @param mainColor the color which gets mixed with the inverted contrast color (dark color -> lighter, light color --> darker)
   * @param amount the amount to mix, 0.0 = mainColor, 1.0 = contrastColor
   * @param useTextAsContrast what to use as contrast. undefined: mainColor's contrast color (default), primary and secondary refers to text.primary and text.secondary from the theme
   * @returns the blended color in hex format
   */
  blendAgainstContrast(
    color: ColorInput,
    amount: number,
    useTextAsContrast: undefined | "primary" | "secondary",
  ): string;

  /**
   * Change Saturation of a color by converting it to HSL
   *
   * @param color the color to change saturation of
   * @param ChangeAmount (-1 to 1) the relative amount to change saturation depending on the current saturation. 0 = no change, -1 = desaturate to gray, 1 = fully saturate.
   * @returns the color with changed saturation in hex format
   */
  changeSaturation(color: ColorInput, ChangeAmount: number): string;

  /**
   * Apply a MUI-style elevation overlay to a color: mixes the source
   * against `palette.background.default` at a level-dependent opacity.
   * Direction (toward lighter or darker) follows the theme mode.
   *
   * @param color the surface color to elevate (hex or named palette role)
   * @param level elevation level 0-24 (clamped); 0 returns the color unchanged
   * @returns the elevated color in hex format
   */
  elevate(color: ColorInput, level: number): string;

  /**
   * Updates `transitions.duration.complex` in-place and refreshes derived
   * transition style snippets that depend on that duration.
   */
  /**
   * Returns a readable text color (typically near-black on a light
   * background, near-white on a dark one) for the supplied hex /
   * named-palette color. Thin wrapper around `palette.getContrastText`
   * so call sites can do `theme.getContrastText(...)` instead of
   * `theme.palette.getContrastText(...)`.
   *
   * Args:
   *     background: any hex/rgb color or named palette role.
   */
  getContrastText(background: string): string;

  setComplexDuration(durationMs: number): void;

  /**
   * Multiplies all transition duration values in-place.
   */
  setDurationMultiplier(multiplier: number): void;

  /**
   * Replaces transition duration values in-place.
   */
  setTransitionDurations(durations: Theme["transitions"]["duration"]): void;
}
/**
 * Config to extend theme.
 * Multiple backgrounds. actual theme gets one of them.
 */
export interface CustomThemeConfig {
  name: string; // Short identifier, e.g. 'ocean'
  longName: string; // Descriptive name, e.g. 'Ocean Breeze'
  backgrounds: string[];
}

export interface ThemeCustomExtension {
  themeName: string; // Short identifier, e.g. 'ocean'
  longName: string; // Descriptive name, e.g. 'Ocean Breeze'
  backgroundImage: string;
}

export interface RecalculateOpions {
  recalculateTextColors?: boolean; // Whether to recalculate text colors based on contrast
  recalculateBackgroundColors?: boolean; // Whether to recalculate background colors based on contrast
  recalculateSuccessInfoWarningErrorColors?: boolean; // Whether to recalculate success, info, warning, and error colors based on contrast
}

/**
 * Implementation of CustomTheme with following features:
 * - blendWithContrast and blendAgainstContrast methods
 * - adjusted text colors
 * - adjusted background colors
 */
export class CustomThemeImpl implements CustomTheme {
  // Declare all Theme properties
  palette!: CustomTheme["palette"];
  custom!: ThemeCustomExtension;
  blendWithConstrast: any;
  breakpoints!: Theme["breakpoints"];
  direction!: Theme["direction"];
  mixins!: Theme["mixins"];
  components?: Theme["components"];
  shadows!: Theme["shadows"];
  spacing!: Theme["spacing"];
  transitions!: Theme["transitions"];
  typography!: Theme["typography"];
  zIndex!: Theme["zIndex"];
  shape!: Theme["shape"];
  unstable_sx!: Theme["unstable_sx"];
  unstable_sxConfig!: Theme["unstable_sxConfig"];
  applyStyles!: Theme["applyStyles"];
  containerQueries!: Theme["containerQueries"];
  colorTransition: {
    root: { transition: string; "&:hover"?: { transition: string } };
  };
  borderRadius: {
    root: { borderRadius: number; "&:hover"?: { borderRadius: number } };
  };
  motion!: Theme["motion"];

  // Wrap the methods to match the Theme interface signature
  alpha: (color: string, value: string | number) => string;
  lighten: (color: string, coefficient: string | number) => string;
  darken: (color: string, coefficient: string | number) => string;
  getContrastText!: (background: string) => string;

  constructor(theme: CustomTheme);
  constructor(theme: Theme | CustomTheme, config: ThemeCustomExtension);
  constructor(
    theme: Theme | CustomTheme,
    config?: ThemeCustomExtension,
    recalculateColors?: RecalculateOpions,
  );
  constructor(
    theme: Theme | CustomTheme,
    config?: ThemeCustomExtension,
    recalculateColors?: RecalculateOpions,
  ) {
    Object.assign(this, theme);

    // If config is provided, use it; otherwise use theme's custom property
    if (config) {
      this.custom = config;
    } else if ("custom" in theme) {
      this.custom = (theme as CustomTheme).custom;
    }

    const { h, s, l } = hexToHsl(theme.palette.primary.main);
    // rotate around primary color
    this.palette.poppyColors = [
      hslToHex((h + 40) % 360, s, l),
      hslToHex((h + 80) % 360, s, l),
      hslToHex((h + 120) % 360, s, l),
      hslToHex((h + 160) % 360, s, l),
      hslToHex((h + 200) % 360, s, l),
      hslToHex((h + 240) % 360, s, l),
    ];
    // Side-rail surface. If the source theme didn't define one
    // (e.g. the empty `material-mark` theme passes only
    // `palette: { mode: "dark" }`), nudge `background.default`
    // slightly: lighter in dark mode, darker in light mode, so
    // the rail lifts off the canvas without competing with cards.
    // Uses the directly-imported MUI helpers because `this.lighten`
    // and `this.darken` aren't bound until further down in the
    // constructor.
    const basePanel = this.palette.background.default;
    const computedPanel =
      this.palette.mode === "dark"
        ? lighten(basePanel, 0.1)
        : darken(basePanel, 0.1);
    this.palette.surfaces = {
      panel: this.palette.surfaces?.panel ?? computedPanel,
    };
    // Contrast color tuned for the AppBar surface, which differs per
    // mode: light mode paints the bar with `primary.main` (so the
    // contrast color comes from `primary.contrastText`); dark mode
    // applies an overlay that effectively re-skins the bar to
    // `background.paper`, where `text.primary` is the readable color.
    // Forcing a single `getContrastText(primary.main)` here is wrong in
    // dark mode because the bar isn't `primary.main` anymore.
    this.palette.contrast =
      this.palette.mode === "dark"
        ? this.palette.text.primary
        : this.palette.primary.contrastText ||
          this.palette.getContrastText(this.palette.primary.main);
    this.typography.fontFamily = '"Fira Sans", sans-serif';

    // Wrap methods to handle string | number parameters
    this.alpha = (color: string, value: string | number) => {
      const numValue = typeof value === "string" ? parseFloat(value) : value;
      return alpha(color, numValue);
    };
    this.lighten = (color: string, coefficient: string | number) => {
      const numCoef =
        typeof coefficient === "string" ? parseFloat(coefficient) : coefficient;
      return lighten(color, numCoef);
    };
    this.darken = (color: string, coefficient: string | number) => {
      const numCoef =
        typeof coefficient === "string" ? parseFloat(coefficient) : coefficient;
      return darken(color, numCoef);
    };
    // Expose `getContrastText` at the theme level so call sites can
    // write `theme.getContrastText(color)` instead of
    // `theme.palette.getContrastText(color)`. Forward to the MUI
    // palette method since it already handles WCAG contrast properly.
    this.getContrastText = (background: string): string => {
      return this.palette.getContrastText(background);
    };

    this.spacing = (...args: Array<number | string>): string => {
      return args
        .map((factor) => {
          const numFactor =
            typeof factor === "string" ? parseFloat(factor) : factor;
          return `${0.25 * Math.pow(2, numFactor)}rem`;
        })
        .join(" ");
    };

    this.borderRadius = {
      root: { borderRadius: 64, "&:hover": { borderRadius: 8 } },
    };

    this.colorTransition = {
      root: {
        transition: this.transitions.create(
          ["background-color", "color", "border-color", "border-radius"],
          {
            duration: this.transitions.duration.complex,
          },
        ),
        "&:hover": {
          transition: this.transitions.create(["all"], {
            duration: this.transitions.duration.short,
          }),
        },
      },
    };

    if (recalculateColors?.recalculateBackgroundColors === true) {
      // blend background colors against contrast color (to increase contrast with text)
      const contrastColor = invertColor(
        this.palette.getContrastText(this.palette.background.default),
      );
      this.palette.background = {
        default: rgbToHex(
          blendColors(
            hexToRgb(this.palette.muted.dark),
            hexToRgb(contrastColor),
            0.25,
          ),
        ),
        paper: rgbToHex(
          blendColors(
            hexToRgb(this.palette.muted.dark),
            hexToRgb(contrastColor),
            0,
          ),
        ),
      };
    }
    if (recalculateColors?.recalculateTextColors === true) {
      // blend text colors with contrast color
      this.palette.text = {
        primary: rgbToHex(
          blendColors(
            hexToRgb(this.palette.primary.light),
            hexToRgb(
              this.palette.getContrastText(this.palette.background.default),
            ),
            0.6,
          ),
        ),
        secondary: rgbToHex(
          blendColors(
            hexToRgb(this.palette.secondary.light),
            hexToRgb(
              this.palette.getContrastText(this.palette.background.default),
            ),
            0.6,
          ),
        ),
        disabled: rgbToHex(
          blendColors(
            hexToRgb(this.palette.primary.main),
            hexToRgb(
              this.palette.getContrastText(this.palette.background.default),
            ),
            0.4,
          ),
        ),
      };

      // bend text colors from primary and secondary colors
      this.palette.primary.contrastText = this.blendWithContrast(
        "primary",
        0.66,
      );
      this.palette.secondary.contrastText = this.blendWithContrast(
        "secondary",
        0.66,
      );
    }

    if (recalculateColors?.recalculateSuccessInfoWarningErrorColors === true) {
      // recalculate success, info, warning, error colors
      this.palette.success = {
        ...this.palette.success,
        main: rgbToHex(
          blendColors(
            hexToRgb(this.palette.primary.main),
            hexToRgb(
              this.palette.getContrastText(this.palette.background.default),
            ),
            0.3,
          ),
        ),
      };

      this.palette.info = {
        ...this.palette.info,
        main: rgbToHex(
          blendColors(
            hexToRgb(this.palette.secondary.main),
            hexToRgb(
              this.palette.getContrastText(this.palette.background.default),
            ),
            0.3,
          ),
        ),
      };

      this.palette.warning = {
        ...this.palette.warning,
        main: rgbToHex(
          blendColors(
            hexToRgb(this.palette.warning.main),
            hexToRgb("#FFA500"), // orange
            0.5,
          ),
        ),
      };

      this.palette.error = {
        ...this.palette.error,
        main: rgbToHex(
          blendColors(
            hexToRgb(this.palette.error.main),
            hexToRgb("#FF0000"), // red
            0.5,
          ),
        ),
      };
    }

    const RootColorAndRadius = deepmerge(
      this.colorTransition,
      this.borderRadius,
    );

    console.log("custom props", RootColorAndRadius);

    // Merge custom component overrides
    const tooltipBbackground = this.elevate(this.palette.background.paper, 24);
    this.components = {
      ...this.components, // Spread existing component overrides
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: tooltipBbackground,
            color: this.palette.getContrastText(tooltipBbackground),
            fontSize: this.typography.caption.fontSize,
            borderRadius: 8,
            border: `1px solid ${this.palette.divider}`,
          },
          arrow: {
            color: tooltipBbackground,
            zIndex: 1, // 1 higher than the tooltip
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          ...RootColorAndRadius,
        },
      },
      MuiButtonGroup: {
        styleOverrides: {
          ...RootColorAndRadius,
        },
      },

      MuiInputBase: {
        styleOverrides: {
          ...RootColorAndRadius,
        },
      },
      MuiPaper: {
        styleOverrides: {
          ...this.colorTransition,
        },
      },
      MuiSlider: {
        styleOverrides: {
          ...this.colorTransition,
        },
      },
      MuiButtonBase: {
        styleOverrides: {
          ...RootColorAndRadius,
        },
      },
      MuiTypography: {
        styleOverrides: {
          ...this.colorTransition,
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          ...RootColorAndRadius,
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          ...RootColorAndRadius,
        },
      },
      // disable hover animation for speed dial and its actions and FABs
      MuiSpeedDial: {
        styleOverrides: {
          fab: {
            borderRadius: "50%",
            "&:hover": {
              borderRadius: "50%",
            },
          },
        },
      },
      MuiSpeedDialAction: {
        styleOverrides: {
          fab: {
            borderRadius: "50%",
            "&:hover": {
              borderRadius: "50%",
            },
          },
        },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            ...this.colorTransition.root,
            borderRadius: 64,
            "&:hover": {
              ...this.colorTransition.root["&:hover"],
              borderRadius: 16,
            },
          },
        },
      },
    };
  }

  blendWithContrast(
    mainColor: ColorInput,
    amount: number,
    useTextAsContrast: undefined | "primary" | "secondary" = undefined,
  ): string {
    const color = this.resolveColor(mainColor);
    const contrastColor = useTextAsContrast
      ? this.palette.text[useTextAsContrast]
      : this.palette.getContrastText(color);

    const mainRgb = hexToRgb(color);
    const contrastRgb = hexToRgb(contrastColor);
    const blended = blendColors(mainRgb, contrastRgb, amount);

    return rgbToHex(blended);
  }

  blendAgainstContrast(
    mainColor: ColorInput,
    amount: number,
    useTextAsContrast: undefined | "primary" | "secondary" = undefined,
  ): string {
    const color = this.resolveColor(mainColor);
    var contrastColor: string;
    if (useTextAsContrast === "primary") {
      contrastColor = this.palette.text.primary;
    } else if (useTextAsContrast === "secondary") {
      contrastColor = this.palette.text.secondary;
    } else {
      contrastColor = this.palette.getContrastText(color);
    }
    const invertedContrastColor = invertColor(contrastColor);
    const mainRgb = hexToRgb(color);
    const contrastRgb = hexToRgb(invertedContrastColor);

    // combines main color with contrast color
    const blended = blendColors(mainRgb, contrastRgb, amount);

    return rgbToHex(blended);
  }

  changeSaturation(color: ColorInput, changeAmount: number): string {
    const resolved = this.resolveColor(color);
    const rgb = hexToRgb(resolved);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    const clampedAmount = Math.max(-1, Math.min(1, changeAmount));
    const nextSaturation =
      clampedAmount >= 0
        ? hsl.s + (1 - hsl.s) * clampedAmount
        : hsl.s + hsl.s * clampedAmount;

    const adjusted = hslToRgb(
      hsl.h,
      Math.max(0, Math.min(1, nextSaturation)),
      hsl.l,
    );

    return rgbToHex(adjusted);
  }

  elevate(color: ColorInput, level: number): string {
    const resolved = this.resolveColor(color);
    // MUI Paper applies the elevation overlay only in dark mode (light mode
    // relies on box-shadow alone). In dark mode the overlay is plain white
    // at the alpha returned by `getOverlayAlpha` (the same curve MUI uses
    // for `Paper elevation={n}`).
    if (this.palette.mode !== "dark") return resolved;
    return blendWithAlpha(resolved, "#ffffff", getOverlayAlpha(level));
  }

  setComplexDuration(durationMs: number): void {
    // Keep duration valid and integral (MUI expects milliseconds).
    const normalized = Math.max(1, Math.round(durationMs));

    // Delegate to the generic setter so dependent transition snippets are refreshed.
    this.setTransitionDurations({
      ...this.transitions.duration,
      complex: normalized,
    });
  }

  setDurationMultiplier(multiplier: number): void {
    // Defensive guard: invalid multipliers fall back to normal speed.
    const safeMultiplier =
      Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;

    // Keep each duration >= 1ms to avoid zero/negative transition times.
    const scale = (value: number) =>
      Math.max(1, Math.round(value * safeMultiplier));

    const current = this.transitions.duration;

    // Scale non-leaving or entering tokens only
    this.setTransitionDurations({
      ...current,
      shortest: scale(current.shortest),
      shorter: scale(current.shorter),
      short: scale(current.short),
      standard: scale(current.standard),
      complex: scale(current.complex),
      enteringScreen: current.enteringScreen,
      leavingScreen: current.leavingScreen,
    });
  }

  setTransitionDurations(durations: Theme["transitions"]["duration"]): void {
    // Merge allows partial updates while preserving untouched duration tokens.
    this.transitions.duration = {
      ...this.transitions.duration,
      ...durations,
    };

    // Some style snippets are precomputed and must be rebuilt after duration changes.
    this.refreshColorTransition();
  }

  refreshColorTransition(): void {
    // Rebuild reusable transition definitions that depend on `transitions.duration`.
    this.colorTransition = {
      root: {
        transition: this.transitions.create(
          ["background-color", "color", "border-color"],
          {
            duration: this.transitions.duration.complex,
          },
        ),
        "&:hover": {
          transition: this.transitions.create(
            ["background-color", "color", "border-color", "transform"],
            {
              duration: this.transitions.duration.short,
            },
          ),
        },
      },
    };
  }

  /**
   * returns hex color for given ColorInput
   *
   * @param color the hex itself, or the name (primary, secondary, ...)
   * @returns a hex color string
   */
  resolveColor(color: ColorInput): string {
    switch (color) {
      case "primary":
        return this.palette.primary.main;
      case "secondary":
        return this.palette.secondary.main;
      case "primaryLight":
        return this.palette.primary.light;
      case "primaryDark":
        return this.palette.primary.dark;
      case "secondaryLight":
        return this.palette.secondary.light;
      case "secondaryDark":
        return this.palette.secondary.dark;
      case "vibrant":
        return this.palette.vibrant.main;
      case "muted":
        return this.palette.muted.main;
    }
    if (color.startsWith("#")) {
      return color;
    }
    console.error(`Unknown color input in resolveColor: ${color}`);
    return color;
  }
}

// Returns the overlay opacity for a given elevation level, matching the
// curve MUI's `<Paper>` uses to tint the surface with `rgba(255,255,255,a)`.
// Source: `packages/mui-material/src/styles/getOverlayAlpha.ts`.
//
// Kept module-level (same rationale as the rgb/hsl helpers below): it
// must not become a (private) member on `CustomThemeImpl`, since that
// would break assignability to `Partial<Theme>`.
function getOverlayAlpha(elevation: number): number {
  let alphaValue;
  if (elevation < 1) {
    alphaValue = 5.11916 * elevation ** 2;
  } else {
    alphaValue = 4.5 * Math.log(elevation + 1) + 2;
  }
  return Math.round(alphaValue * 10) / 1000;
}

// Mixes a color toward `overlay` at fractional opacity `alpha` (0-1).
// Equivalent to `alpha(overlay, alpha)` composited over `base`.
function blendWithAlpha(base: string, overlay: string, alpha: number): string {
  const baseRgb = hexToRgb(base);
  const overlayRgb = hexToRgb(overlay);
  return rgbToHex({
    r: Math.round(baseRgb.r + (overlayRgb.r - baseRgb.r) * alpha),
    g: Math.round(baseRgb.g + (overlayRgb.g - baseRgb.g) * alpha),
    b: Math.round(baseRgb.b + (overlayRgb.b - baseRgb.b) * alpha),
  });
}

// Module-level color helpers. Kept out of the class so that they don't appear
// as (private) members on `CustomThemeImpl`'s type, which would otherwise
// break assignability to `Partial<Theme>` (TS structural privacy check).
function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) {
    return { h: 0, s: 0, l };
  }

  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let h = 0;

  switch (max) {
    case rn:
      h = (gn - bn) / delta + (gn < bn ? 6 : 0);
      break;
    case gn:
      h = (bn - rn) / delta + 2;
      break;
    case bn:
      h = (rn - gn) / delta + 4;
      break;
    default:
      h = 0;
  }

  h /= 6;

  return { h, s, l };
}

function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  if (s === 0) {
    const gray = Math.round(l * 255);
    return { r: gray, g: gray, b: gray };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const hue2rgb = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const r = hue2rgb(h + 1 / 3);
  const g = hue2rgb(h);
  const b = hue2rgb(h - 1 / 3);

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}
