import {
  Box,
  IconButton,
  Tooltip,
  type SxProps,
  type Theme,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import { M1, M2, M3 } from "../../statics";

export interface HeaderImageViewProps {
  /** Already prepared (backend-linked) image source. */
  imageUrl: string;
  /** Alt text for the rendered image. */
  alt: string;
  /**
   * When provided, an image button is painted in the top-right corner
   * of the banner. The caller owns the upload modal.
   */
  onChange?: () => void;
  /**
   * Overlaid content, vertically centered on the guide line at 5/13 of
   * the image height from the bottom. The title lives here so it reads
   * as part of the banner.
   */
  children?: React.ReactNode;
  /** Content pinned to the top-left (e.g. breadcrumbs) on the same blur. */
  topLeft?: React.ReactNode;
  /** Extra styles for the wrapping box. */
  sx?: SxProps<Theme>;
}

/**
 * The painted header banner.
 *
 * It reads *every* color through MUI's `useTheme()`, so it must be
 * rendered as a descendant of the `ThemeProvider` in
 * `HeaderImageBanner`. That provider injects the ambient app/note
 * theme:
 *
 *   - text: `theme.palette.text.primary`
 *   - overlay / caption surface: the ambient surface colors, tinted
 *     with `theme.palette.primary.main`
 *
 * Building this markup in the parent instead would resolve the ambient
 * app / note theme, since a provider only affects its descendants.
 */
export const HeaderImageView: React.FC<HeaderImageViewProps> = ({
  imageUrl,
  alt,
  onChange,
  children,
  topLeft,
  sx,
}) => {
  const theme = useTheme();

  // The image is pulled toward the ambient palette: a soft primary
  // wash at the top, a faint secondary tint on the left, and a scrim
  // that gets heavier toward the caption. Without this the photo sits
  // on the page as a foreign element.
  const globalOverlay = [
    `radial-gradient(120% 160% at 18% 0%, ${alpha(
      theme.palette.primary.main,
      theme.palette.mode === "dark" ? 0.4 : 0.3,
    )} 0%, ${alpha(theme.palette.primary.main, 0)} 58%)`,
    `linear-gradient(90deg, ${alpha(
      theme.palette.secondary.main,
      0.24,
    )} 0%, ${alpha(theme.palette.secondary.main, 0)} 46%)`,
    `linear-gradient(180deg, ${alpha(
      theme.palette.background.paper,
      0.06,
    )} 0%, ${alpha(theme.palette.background.paper, 0.2)} 38%, ${alpha(
      theme.palette.background.paper,
      0.72,
    )} 76%, ${alpha(theme.palette.background.paper, 0.92)} 100%)`,
  ].join(", ");

  // Caption / breadcrumb surface: a frosted sheet of the theme's own
  // paper color with a primary hairline border and a soft drop shadow,
  // so the blurred image shows through but the text always reads on
  // the app surface.
  const captionSurface: SxProps<Theme> = {
    backgroundImage: `linear-gradient(to right, ${alpha(theme.blendAgainstContrast("primary", 0.2, "primary"), 0.3)} 0%, ${alpha(theme.blendAgainstContrast("primary", 0.2, "primary"), 0)} 100%)`,
    color: theme.palette.text.primary,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(16px)",
  };

  return (
    <Box
      sx={[
        {
          position: "relative",
          width: "100%",
          // "1:3" in the request means height:width, i.e. a wide, low
          // band three times wider than it is tall.
          aspectRatio: "3 / 1",
          overflow: "hidden",
          borderRadius: 2,
          backgroundColor: theme.palette.background.paper,
          // A hairline edge and an inner shade anchor the photo to the
          // surrounding paper instead of letting it float on top.
          boxShadow: `0 10px 30px ${alpha(
            theme.palette.common.black,
            theme.palette.mode === "dark" ? 0.34 : 0.14,
          )}, inset 0 0 0 1px ${alpha(theme.palette.divider, 0.7)}`,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        component="img"
        src={imageUrl}
        alt={alt}
        sx={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          backgroundImage: globalOverlay,
        }}
      />

      {topLeft && (
        <Box
          sx={[
            captionSurface,
            {
              position: "absolute",
              top: M2,
              left: M3,
              zIndex: 2,
              maxWidth: "calc(100% - 6rem)",
              display: "inline-flex",
              px: M2,
              py: M1,
              borderRadius: 1,
              color: theme.palette.primary.contrastText,
            },
          ]}
        >
          {topLeft}
        </Box>
      )}

      {children && (
        // Conceptual guide line at 5/13 (about 38.46%) of the image
        // height, measured from the bottom. The row is anchored on
        // that line and shifted down by half its own height, so the
        // caption panel is vertically centered on the line instead
        // of sitting above it. The band itself paints nothing.
        <Box
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: `${((5 / 13) * 100).toFixed(2)}%`,
            transform: "translateY(50%)",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            px: M3,
            boxSizing: "border-box",
          }}
        >
          {/* Blur + theme dye sits behind the text only: the box
              shrinks to its content with M3 horizontal / M2 vertical
              padding. In global mode this is a frosted theme surface
              with a primary border and soft shadow. */}
          <Box
            sx={[
              {
                position: "relative",
                display: "inline-flex",
                maxWidth: "100%",
                px: M3,
                py: M2,
                borderRadius: theme.shape.borderRadius,
              },
              captionSurface,
            ]}
          >
            {children}
          </Box>
        </Box>
      )}

      {onChange && (
        <Tooltip title="Change header image">
          <IconButton
            aria-label="change header image"
            onClick={onChange}
            size="small"
            sx={[
              {
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 3,
                color: theme.palette.text.primary,
              },
              {
                backgroundColor: alpha(
                  theme.palette.background.paper,
                  0.78,
                ),
                border: `1px solid ${alpha(
                  theme.palette.primary.main,
                  0.3,
                )}`,
                backdropFilter: "blur(16px) saturate(150%)",
                WebkitBackdropFilter: "blur(16px) saturate(150%)",
                boxShadow: `0 6px 18px ${alpha(
                  theme.palette.common.black,
                  0.2,
                )}`,
                "&:hover": {
                  backgroundColor: alpha(
                    theme.palette.background.paper,
                    0.94,
                  ),
                },
              },
            ]}
          >
            <AddPhotoAlternateIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export default HeaderImageView;
