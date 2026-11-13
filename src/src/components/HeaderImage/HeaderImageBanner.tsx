import { useMemo } from "react";
import { ThemeProvider } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material";
import { useThemeStore } from "../../zustand/useThemeStore";
import { prepareBackendLink } from "../../utils/prepareBackendLink";
import { HeaderImageView } from "./HeaderImageView";

export interface HeaderImageBannerProps {
  /** Raw image URL from the document's header Markdown. */
  imageUrl?: string | null;
  /** Alt text for the rendered image. */
  alt?: string;
  /**
   * When provided, an image button is painted in the top-right corner
   * of the banner. The caller owns the upload modal (so the same modal
   * can also be opened from the top bar's overflow menu).
   */
  onChange?: () => void;
  /**
   * Overlaid content, anchored at 5/13 of the image height from the
   * bottom. The title lives here so it reads as part of the banner.
   */
  children?: React.ReactNode;
  /** Content pinned to the top-left (e.g. breadcrumbs) on the same blur. */
  topLeft?: React.ReactNode;
  /** Extra styles for the wrapping box. */
  sx?: SxProps<Theme>;
}

/**
 * Full-bleed, low-height header image (3:1 width:height) shown at the
 * top of directory and note pages.
 *
 * The banner keeps the ambient app/note theme and pulls the image
 * toward it: a palette-tinted overlay, a bottom scrim for legibility
 * and a blurred, bordered caption panel. The `ThemeProvider` below
 * makes that ambient theme explicit for `HeaderImageView`, which reads
 * every color through MUI's `useTheme()`.
 *
 * Purely presentational: it never uploads anything itself. The parent
 * decides whether the top-right image affordance is available and
 * mounts the shared `ImageUploadModal`.
 */
export const HeaderImageBanner: React.FC<HeaderImageBannerProps> = ({
  imageUrl,
  alt = "Header image",
  onChange,
  children,
  topLeft,
  sx,
}) => {
  const { theme: appTheme } = useThemeStore();
  const resolvedImageUrl = useMemo(
    () => (imageUrl ? prepareBackendLink(imageUrl) : ""),
    [imageUrl],
  );

  if (!imageUrl) {
    return null;
  }

  return (
    <ThemeProvider theme={appTheme}>
      <HeaderImageView
        imageUrl={resolvedImageUrl}
        alt={alt}
        topLeft={topLeft}
        onChange={onChange}
        sx={sx}
      >
        {children}
      </HeaderImageView>
    </ThemeProvider>
  );
};

export default HeaderImageBanner;
