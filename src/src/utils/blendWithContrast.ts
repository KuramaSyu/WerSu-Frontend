import { useTheme } from "@mui/material/styles";
import { type CustomTheme } from "../theme/customTheme";

// Helpers
export function hexToRgb(hex: string) {
  hex = hex.replace("#", "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const bigint = parseInt(hex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

export function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
}

/**
 * calculates the relative luminance of a color
 *
 * @param r red amount
 * @param g green amount
 * @param b blue amount
 * @returns luminance of the color (0-1)
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs = 0, gs = 0, bs = 0] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex);

  const luminance = getRelativeLuminance(rgb.r, rgb.g, rgb.b);
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

export function invertColor(hex: string): string {
  const rgb = hexToRgb(hex);
  const inverted = {
    r: 255 - rgb.r,
    g: 255 - rgb.g,
    b: 255 - rgb.b,
  };
  return rgbToHex(inverted);
}

export function blendColors(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number },
  ratio: number,
) {
  return {
    r: Math.round(color1.r + (color2.r - color1.r) * ratio),
    g: Math.round(color1.g + (color2.g - color1.g) * ratio),
    b: Math.round(color1.b + (color2.b - color1.b) * ratio),
  };
}

/**
 * mixes the mainColor with its calculated contrast color
 * to a specified amount. Like a dynamic brighten() or darken()
 * depending on the color's luminance.
 * @param mainColor the color to mix
 * @param amount the amount to mix, 0.0 = mainColor, 1.0 = contrastColor
 * @returns the blended color in hex format
 */
export function blendAgainstContrast(
  mainColor: string,
  theme: CustomTheme,
  amount: number,
): string {
  const contrastColor = invertColor(theme.palette.getContrastText(mainColor));

  const mainRgb = hexToRgb(mainColor);
  const contrastRgb = hexToRgb(contrastColor);
  const blended = blendColors(mainRgb, contrastRgb, amount);

  return rgbToHex(blended);
}

/**
 * mixes the mainColor with the contrast color from the theme
 * to a specified amount. Like a dynamic brigthen() or darken()
 * depending theme.
 * @param mainColor the color to mix
 * @param theme the theme to use to get the contrast color
 * @param amount the amount to mix, 0.0 = mainColor, 1.0 = contrastColor
 * @returns the blended color in hex format
 */
export function blendWithContrast(
  mainColor: string,
  theme: any,
  amount: number,
) {
  const contrastColor = theme.palette.getContrastText(mainColor); // '#fff' or '#000'

  const mainRgb = hexToRgb(mainColor);
  const contrastRgb = hexToRgb(contrastColor);
  const blended = blendColors(mainRgb, contrastRgb, amount);

  return rgbToHex(blended);
}

/**
 * checks if a color is dark based on its luminance
 * @param color the color to check
 * @returns true if dark, false if light
 */
export function isDarkColored(color: string): boolean {
  return getContrastColor(color) === "#ffffff";
}
/**
 * Converts a HEX color string to HSL.
 *
 * Supports both:
 * - #RRGGBB (e.g. "#1976d2")
 * - #RGB (e.g. "#09f")
 *
 * Returns:
 * - h: Hue in degrees [0, 360]
 * - s: Saturation percentage [0, 100]
 * - l: Lightness percentage [0, 100]
 *
 * @example
 * const hsl = hexToHsl("#1976d2");
 * // { h: 209, s: 79, l: 46 }
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace(/^#/, "");

  // Expand shorthand notation (#abc -> #aabbcc)
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  let h = 0;
  let s = 0;

  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;

    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;

      case g:
        h = (b - r) / d + 2;
        break;

      case b:
        h = (r - g) / d + 4;
        break;
    }

    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Converts an HSL color to a HEX color string.
 *
 * Parameters:
 * - h: Hue in degrees [0, 360]
 * - s: Saturation percentage [0, 100]
 * - l: Lightness percentage [0, 100]
 *
 * Returns a HEX color in the format "#RRGGBB".
 *
 * @example
 * hslToHex(209, 79, 46);
 * // "#1976d2"
 */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (value: number): string =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** generates a color which matches the theme colors, using the same
 * hue but rotating around H. The given string will be hashed and the hue
 * number will get calculated from the hash to ensure stable colors per string
 */
export function colorFromString(str: string, theme: CustomTheme): string {
  let hash = 0;

  // calculates the hash of the string
  for (let i = 0; i < str.length; i++) {
    // (hash * 32) - hash = hash * 31
    // -> hash * 31 + charCodeAt(i)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360; // Get a hue value between 0 and 359
  // primary hsl
  const { h, s, l } = hexToHsl(theme.palette.primary.main);
  // rotate arround hue
  return hslToHex(hue, s, l);
}
