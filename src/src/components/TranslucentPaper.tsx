import { Paper, type PaperProps, type SxProps } from "@mui/material";
import { alpha, useTheme, type Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import { useSelectedBackgroundImageStore } from "../zustand/useSelectedBackgroundImageStore";
import { useThemeStore } from "../zustand/useThemeStore";

// Opacity per elevation level (0..11). Elevation 1 is the main shell (50%),
// elevation 4 is the top bar / rails (90%).
const ELEVATION_OPACITY: Readonly<Record<number, number>> = {
  0: 0.5,
  1: 0.5,
  2: 0.9,
  3: 0,
  4: 0.9,
  5: 0.18,
  6: 0.16,
  7: 0.14,
  8: 0.12,
  9: 0.1,
  10: 0.08,
  11: 0.06,
};

const DEFAULT_OPACITY = 0.2;

export interface TranslucentPaperProps extends Omit<PaperProps, "elevation"> {
  // MUI elevation (0..11). Drives the translucency.
  elevation?: number;
  // Optional background color override. Tinted with the elevation alpha.
  backgroundColor?: string;
  children?: ReactNode;
}

// Pull the last defined backgroundColor out of a sx value.
// The caller's color is the base the alpha is applied to.
function extractBackgroundColor(
  sx: SxProps<Theme> | undefined,
): string | undefined {
  if (sx === undefined) {
    return undefined;
  }
  const list = Array.isArray(sx) ? sx : [sx];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const entry = list[i];
    if (
      entry !== null &&
      typeof entry === "object" &&
      "backgroundColor" in entry
    ) {
      const value = (entry as { backgroundColor?: unknown }).backgroundColor;
      if (typeof value === "string") {
        return value;
      }
    }
  }
  return undefined;
}

// Drop backgroundColor from every sx entry so the caller cannot
// bypass the translucency by passing it through sx.
function withoutBackgroundColor(
  sx: SxProps<Theme> | undefined,
): SxProps<Theme> | undefined {
  if (sx === undefined) {
    return undefined;
  }
  const list = Array.isArray(sx) ? sx : [sx];
  return list.map((entry) => {
    if (entry === null || typeof entry !== "object") {
      return entry;
    }
    if ("backgroundColor" in entry) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { backgroundColor: _drop, ...rest } = entry as Record<
        string,
        unknown
      >;
      return rest;
    }
    return entry;
  }) as SxProps<Theme>;
}

// Match AppBackground: a URL is active when either the user picked one
// or the theme supplies one.
function pickBackgroundUrl(
  userImage: string | null,
  themeImage: string | undefined,
): string | undefined {
  if (userImage !== null && userImage.length > 0) {
    return userImage;
  }
  if (themeImage !== undefined && themeImage !== "" && themeImage.length > 0) {
    return themeImage;
  }
  return undefined;
}

// A Paper whose opacity is tied to its elevation. With an active
// background the paper color is alpha-tinted so the image shines
// through; without a background the paper is solid and the whole
// surface drops to the matching opacity instead.
export const TranslucentPaper: React.FC<TranslucentPaperProps> = ({
  elevation = 1,
  backgroundColor,
  children,
  sx,
  ...paperProps
}) => {
  const theme = useTheme();
  const userImage = useSelectedBackgroundImageStore((s) => s.userImage);
  const themeBackground = useThemeStore((s) => {
    const custom = s.theme.custom;
    return custom.chosenBackgroundImage ?? custom.backgroundImages[0] ?? "";
  });
  const hasBackground =
    pickBackgroundUrl(userImage, themeBackground) !== undefined;

  const safeElevation = Math.max(0, Math.min(11, Math.round(elevation)));
  const opacity = ELEVATION_OPACITY[safeElevation] ?? DEFAULT_OPACITY;
  const sxBg = extractBackgroundColor(sx);
  const base = backgroundColor ?? sxBg ?? theme.palette.background.paper;
  const tinted = hasBackground ? alpha(base, opacity) : base;
  const cleanedSx = withoutBackgroundColor(sx);
  const surfaceSx: SxProps<Theme> = {
    backgroundImage: "none",
    backgroundColor: tinted,
  };

  return (
    <Paper
      {...paperProps}
      elevation={safeElevation}
      sx={[
        surfaceSx,
        ...(Array.isArray(cleanedSx)
          ? cleanedSx
          : cleanedSx !== undefined
            ? [cleanedSx]
            : []),
      ]}
    >
      {children}
    </Paper>
  );
};

export default TranslucentPaper;
