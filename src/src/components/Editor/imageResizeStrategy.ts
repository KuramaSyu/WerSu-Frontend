// Strategy abstraction for how an image node stores its size inside the
// raw `style` attribute.
//
// The default strategy (`CustomWidthAutoHeightStrategy`) keeps a single
// CSS width (px or %) and lets the height follow automatically; an
// explicit height is only written when the user stretches the image with
// the aspect-ratio lock disabled. Swapping the storage format later
// (e.g. a width+height pair, or a `width` HTML attribute) only means
// implementing this interface and pointing `defaultImageResizeStrategy`
// at the new object — the node view and bubble menu only talk to the
// interface.

export type ImageSizeUnit = "px" | "%";

export interface ImageDimension {
  value: number;
  unit: ImageSizeUnit;
}

export interface ImageResizeGeometry {
  width: ImageDimension | null;
  /**
   * `null` means "let the height follow the width" (CSS `height: auto`);
   * only set when the user stretched the image without the lock.
   */
  height: ImageDimension | null;
}

export interface ImageQuickSize {
  label: string;
  width: ImageDimension;
}

export interface ImageResizeStrategy {
  id: string;
  label: string;
  /** Extract the geometry this strategy manages from a style string. */
  parse(style: string | null | undefined): ImageResizeGeometry;
  /**
   * Render `geometry` back to a CSS declaration string, preserving any
   * declarations in `previousStyle` the strategy does not manage.
   * Returning `""` clears the style attribute (plain markdown image).
   */
  serialize(
    geometry: ImageResizeGeometry,
    previousStyle?: string | null,
  ): string;
  /** Decide the geometry to persist after a pixel-based drag. */
  fromPixels(input: {
    width: number;
    height: number;
    aspectRatio: number;
    locked: boolean;
  }): ImageResizeGeometry;
  /** Quick width presets offered in the image bubble menu. */
  quickSizes: readonly ImageQuickSize[];
}

/** Parse a CSS declaration string into ordered `[key, value]` pairs. */
export function parseStyleDeclarations(
  style: string | null | undefined,
): Array<[string, string]> {
  if (!style) return [];
  const out: Array<[string, string]> = [];
  for (const declaration of style.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon === -1) continue;
    const key = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    if (key && value) out.push([key, value]);
  }
  return out;
}

/** Convert a raw style string into the shape MUI's `sx` prop expects. */
export function styleStringToSx(
  style: string | null | undefined,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of parseStyleDeclarations(style)) {
    // MUI sx requires camelCase for hyphenated CSS props.
    const camel = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = value;
  }
  return out;
}

function parseDimension(value: string | undefined): ImageDimension | null {
  if (!value) return null;
  const match = /^(-?\d*\.?\d+)\s*(px|%)?$/i.exec(value.trim());
  if (!match) return null;
  const value_ = Number.parseFloat(match[1]);
  if (!Number.isFinite(value_)) return null;
  const unit: ImageSizeUnit = match[2]?.toLowerCase() === "%" ? "%" : "px";
  return { value: value_, unit };
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}`;
}

function formatDimension(dimension: ImageDimension): string {
  return `${formatNumber(dimension.value)}${dimension.unit}`;
}

const MANAGED_DECLARATIONS = new Set(["width", "height"]);

/**
 * Default sizing strategy: a single CSS width plus `height: auto`.
 * Explicit height is only persisted when the drag actually stretched the
 * image away from its natural aspect ratio (lock disabled).
 */
export const CustomWidthAutoHeightStrategy: ImageResizeStrategy = {
  id: "custom-width-auto-height",
  label: "Width / auto height",

  parse(style) {
    const declarations = parseStyleDeclarations(style);
    const find = (key: string) =>
      declarations.find(([k]) => k.toLowerCase() === key)?.[1];
    return {
      width: parseDimension(find("width")),
      height: parseDimension(find("height")),
    };
  },

  serialize(geometry, previousStyle) {
    const declarations = parseStyleDeclarations(previousStyle).filter(
      ([key]) => !MANAGED_DECLARATIONS.has(key.toLowerCase()),
    );

    if (geometry.width) {
      declarations.push(["width", formatDimension(geometry.width)]);
    }
    if (geometry.height) {
      declarations.push(["height", formatDimension(geometry.height)]);
    } else if (geometry.width) {
      declarations.push(["height", "auto"]);
    }

    return declarations.map(([key, value]) => `${key}: ${value}`).join("; ");
  },

  fromPixels({ width, height, aspectRatio, locked }) {
    const matchesNaturalHeight =
      aspectRatio > 0 && Math.abs(height - width / aspectRatio) < 1;
    return {
      width: { value: Math.round(width), unit: "px" },
      height:
        locked || matchesNaturalHeight
          ? null
          : { value: Math.round(height), unit: "px" },
    };
  },

  quickSizes: [25, 50, 75, 100].map((percent) => ({
    label: `${percent}%`,
    width: { value: percent, unit: "%" },
  })),
};

/** The strategy the editor currently uses. Swap this to change storage. */
export const defaultImageResizeStrategy: ImageResizeStrategy =
  CustomWidthAutoHeightStrategy;
