import {
  alpha,
  lighten,
  darken,
  type Palette,
  type Theme,
  type Motion,
} from "@mui/material/styles";
import { getContrastRatio } from "@mui/system/colorManipulator";
import {
  blendColors,
  getRelativeLuminance,
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

/** Alias of MUI Theme; the augmenting module below adds the project's extra fields. */
export type CustomTheme = Theme;

// Augment MUI's Theme/Palette so useTheme() returns our extended type.
// CustomTheme is now an alias of Theme; these declarations drive runtime typing.
declare module "@mui/material/styles" {
  interface Palette {
    poppyColors: string[];
  }
  interface PaletteOptions {
    poppyColors?: string[];
  }
  interface Theme {
    colorTransition: {
      root: { transition: string; "&:hover"?: { transition: string } };
    };
    /** Color-only transition snippets for wrappers whose children paint via currentColor. */
    iconTransition: {
      root: { transition: string; "&:hover"?: { transition: string } };
    };

    /** Mix color with theme contrast at amount (0..1). */
    blendWithContrast(
      color: ColorInput,
      amount: number,
      useTextAsContrast: undefined | "primary" | "secondary",
    ): string;

    /** Mix color with its own inverted contrast at amount (0..1). */
    blendAgainstContrast(
      color: ColorInput,
      amount: number,
      useTextAsContrast: undefined | "primary" | "secondary",
    ): string;

    /** Shift saturation (-1 desaturate to gray, +1 fully saturate). */
    changeSaturation(color: ColorInput, ChangeAmount: number): string;

    /** Apply MUI-style elevation overlay; direction follows palette mode. */
    elevate(color: ColorInput, level: number): string;

    /** Update transitions.duration.complex and refresh derived snippets. */
    setComplexDuration(durationMs: number): void;
    /** Multiply all transition durations in-place. */
    setDurationMultiplier(multiplier: number): void;
    /** Replace transition durations in-place. */
    setTransitionDurations(durations: Theme["transitions"]["duration"]): void;
  }
}
/** Theme extension config; one background is picked from the list at runtime. */
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

/** Theme wrapper adding blend helpers and adjusted text/background colors. */
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

  iconTransition!: {
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

    // Reuse MUI contrast math: pick the readable palette token.
    const threshold = this.palette.contrastThreshold ?? 3;
    this.palette.getContrastText = (background: string): string => {
      const textContrast = getContrastRatio(
        background,
        this.palette.text.primary,
      );
      if (textContrast >= threshold) {
        return this.palette.text.primary;
      }
      return this.palette.background.default;
    };

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
    // Side-rail surface: nudge background.default so the rail lifts
    // off the canvas. Uses imported helpers (this.lighten/darken unbound yet).
    const basePanel = this.palette.background.default;
    const computedPanel =
      this.palette.mode === "dark"
        ? lighten(basePanel, 0.1)
        : darken(basePanel, 0.1);
    this.palette.surfaces = {
      panel: this.palette.surfaces?.panel ?? computedPanel,
    };
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
          transition: this.transitions.create(
            [
              "background-color",
              "color",
              "border-color",
              "transform",
              "border-radius",
            ],
            {
              duration: this.transitions.duration.short,
            },
          ),
        },
      },
    };
    this.iconTransition = {
      root: {
        transition: this.transitions.create(["color"], {
          duration: this.transitions.duration.complex,
        }),
        "&:hover": {
          transition: this.transitions.create(["color"], {
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
      // Blend text colors toward contrast color.
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

    // Compute once, then merge into component overrides below.
    const tooltipBbackground = this.elevate(this.palette.background.paper, 24);
    this.components = {
      ...this.components, // Spread existing component overrides
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: tooltipBbackground,
            // Derive contrast color from the tooltip's own background.
            color: this.palette.getContrastText(tooltipBbackground),
            fontSize: this.typography.caption.fontSize,
            borderRadius: 8,
          },
          arrow: {
            color: this.elevate(this.palette.background.paper, 24),
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
            // 50% for circular FABs; override if not wanted
            borderRadius: "50%",
            "&:hover": {
              borderRadius: "50%",
            },
          },
        },
      },
      // hide border from menu rows
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            "&:hover": {
              borderRadius: 8,
            },
          },
        },
      },
      // MuiListItemButton inherits RootColorAndRadius pill->8px hover.
      // Pin hover radius to 8 so the row shape stays steady on selection.
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            "&:hover": {
              borderRadius: 8,
            },
          },
        },
      },

      MuiSvgIcon: {
        styleOverrides: {
          root: {
            color: this.palette.text.primary,
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
    // relies on box-shadow alone); reuse getOverlayAlpha's curve.
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
    // Merge for partial updates; refresh derived snippets after.
    this.transitions.duration = {
      ...this.transitions.duration,
      ...durations,
    };
    this.refreshColorTransition();
  }

  refreshColorTransition(): void {
    // Rebuild snippets that depend on transitions.duration.
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
    this.iconTransition = {
      root: {
        transition: this.transitions.create(["color"], {
          duration: this.transitions.duration.complex,
        }),
        "&:hover": {
          transition: this.transitions.create(["color"], {
            duration: this.transitions.duration.short,
          }),
        },
      },
    };
    this.iconTransition = {
      root: {
        transition: this.transitions.create(["color"], {
          duration: this.transitions.duration.complex,
        }),
        "&:hover": {
          transition: this.transitions.create(["color"], {
            duration: this.transitions.duration.short,
          }),
        },
      },
    };
  }

  /** Resolve a hex or palette role to a hex string. */
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

// Overlay opacity for MUI's Paper elevation curve (dark mode only).
// Module-level because it must not become a private CustomThemeImpl member.
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

// Module-level color helpers kept out of the class so CustomThemeImpl stays
// assignable to Partial<Theme> (TS structural privacy check on private members).
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
