import { Chip, useTheme, type ChipProps, type Theme } from "@mui/material";

/**
 * Status palette colors the standard `Chip` component understands.
 * Pass one of these via `colorProp` to get the matching palette tone
 * (filled background + auto-contrast label) without overriding the
 * accent explicitly.
 */
export type ColorChipStatus =
  | "default"
  | "primary"
  | "secondary"
  | "error"
  | "warning"
  | "info"
  | "success";

/**
 * A chip whose label color is always the contrast color of its actual
 * rendered background.
 *
 * Two modes are supported:
 *   - `colorProp` ("success" | "error" | ...): pull the filled
 *     background from `theme.palette[colorProp].main` and resolve
 *     the label color with `getContrastText`.
 *   - `colorOverride` (any CSS hex): use that exact value as the
 *     background and still resolve the label with `getContrastText`.
 *
 * One of the two should be provided; `colorOverride` wins if both are
 * supplied. The component also keeps MUI's standard border so the chip
 * stays legible on light/dark themes.
 */
export type ColorChipProps = Omit<ChipProps, "color"> & {
  colorProp?: ColorChipStatus;
  colorOverride?: string;
};

/**
 * Resolves the palette tone for a status key while keeping the lookup
 * fully typed. The mapped keys narrow to the `PaletteColor`-shaped
 * subset of `Theme["palette"]`, so `theme.palette[k]?.main`/`.dark`
 * type-check without an `any` escape hatch.
 */
type PaletteToneKey = Exclude<ColorChipStatus, "default">;

type PaletteColorKey = {
  [K in keyof Theme["palette"]]: Theme["palette"][K] extends {
    main: string;
    dark?: string;
  }
    ? K
    : never;
}[keyof Theme["palette"]];

const STATUS_TO_PALETTE_KEY: Record<PaletteToneKey, PaletteColorKey> = {
  primary: "primary",
  secondary: "secondary",
  error: "error",
  warning: "warning",
  info: "info",
  success: "success",
};

const getPaletteTone = (
  status: ColorChipStatus,
): PaletteColorKey | undefined => {
  if (status === "default") {
    return undefined;
  }
  return STATUS_TO_PALETTE_KEY[status];
};

export const ColorChip: React.FC<ColorChipProps> = ({
  colorProp = "default",
  colorOverride,
  sx,
  ...rest
}) => {
  const theme = useTheme();
  const toneKey = getPaletteTone(colorProp);
  const tone = toneKey
    ? (theme.palette[toneKey] as { main: string; dark?: string } | undefined)
    : undefined;
  const bg = colorOverride ?? tone?.main;
  const text = bg ? theme.palette.getContrastText(bg) : undefined;
  const border = bg ? (tone?.dark ?? bg) : undefined;

  return (
    <Chip
      {...rest}
      sx={[
        {
          fontWeight: 400,
          ...(bg ? { backgroundColor: bg } : {}),
          ...(border ? { border: `1px solid ${border}` } : {}),
          ...(text ? { color: text } : {}),
          "& .MuiChip-label": text ? { color: text } : undefined,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    />
  );
};
