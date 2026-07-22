import {
  Avatar,
  Box,
  Card,
  CardContent,
  IconButton,
  Skeleton,
  Typography,
} from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { formatDistanceToNow } from "date-fns";
import { useThemeStore } from "../../zustand/useThemeStore";
import { blendWithContrast } from "../../utils/blendWithContrast";
import { prepareBackendLink } from "../../utils/prepareBackendLink";

/** Visual size preset for the card; resolved to concrete dimensions below. */
export type CardSize = "small" | "medium" | "large";

interface CardDimensions {
  width: number;
  height: number;
  // Image area height at rest. Pinned to a 16:9 ratio of `width`.
  imageHeight: number;
  // Image area height on hover. Pinned to a 3:2 ratio of `width`.
  imageHoverHeight: number;
  iconSize: number;
  starIconSize: "small" | "medium" | "large";
  titleVariant: "h5" | "h6" | "subtitle1" | "subtitle2";
  subtitleVariant: "body2" | "caption";
  // CardContent padding + bottom margin under the title.
  contentPadding: string;
  titleBottomMargin: string;
}

// Image heights follow a fixed aspect ratio:
//   - `imageHeight`    = width * 9 / 16  (16:9 at rest)
//   - `imageHoverHeight` = width * 2 / 3  (3:2 on hover)
const RATIO_SIXTEEN_BY_NINE = 9 / 16;
const RATIO_THREE_BY_TWO = 2 / 3;
const SIXTEEN_BY_NINE = (width: number) =>
  Math.round(width * RATIO_SIXTEEN_BY_NINE);
const THREE_BY_TWO = (width: number) => Math.round(width * RATIO_THREE_BY_TWO);

const CARD_DIMENSIONS: Record<CardSize, CardDimensions> = {
  small: {
    width: 160,
    height: 150,
    imageHeight: SIXTEEN_BY_NINE(160),
    imageHoverHeight: THREE_BY_TWO(160),
    iconSize: 32,
    starIconSize: "small",
    titleVariant: "subtitle1",
    subtitleVariant: "caption",
    contentPadding: "0.375rem",
    titleBottomMargin: "0.125rem",
  },
  medium: {
    width: 220,
    height: 200,
    imageHeight: SIXTEEN_BY_NINE(220),
    imageHoverHeight: THREE_BY_TWO(220),
    iconSize: 48,
    starIconSize: "medium",
    titleVariant: "h6",
    subtitleVariant: "caption",
    contentPadding: "0.5rem",
    titleBottomMargin: "0.25rem",
  },
  large: {
    width: 300,
    height: 260,
    imageHeight: SIXTEEN_BY_NINE(300),
    imageHoverHeight: THREE_BY_TWO(300),
    iconSize: 64,
    starIconSize: "medium",
    titleVariant: "h5",
    subtitleVariant: "body2",
    contentPadding: "0.75rem",
    titleBottomMargin: "0.5rem",
  },
};

export interface FolderCardViewProps {
  /** Display name shown on the card. */
  displayName: string;
  /** Optional `onClick` handler (e.g. navigation). If omitted the card is not clickable. */
  onClick?: () => void;
  /**
   * Most recent activity timestamp in ISO 8601 format; when omitted
   * the card renders "No activity yet".
   */
  imageUrl?: string;
  lastModified?: string;
  /** When true, render the skeleton placeholder instead of the populated card. */
  loading?: boolean;
  /** Hide the card entirely (e.g. when the underlying directory is missing). */
  hidden?: boolean;
  /** Visual size preset; defaults to `medium`. */
  size?: CardSize;
  /** Whether the directory is in the user's favourites. Drives the star icon state. */
  isFavourite?: boolean;
  /**
   * Click handler for the favourite star. Should `stopPropagation`.
   */
  onToggleFavourite?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Pure presentation for a single favourite directory card.
 * Resolves store / data concerns in `FolderCard` and passes the
 * resulting values as props here.
 */
export const FolderCardView: React.FC<FolderCardViewProps> = ({
  displayName,
  onClick,
  lastModified,
  imageUrl = undefined,
  loading = false,
  hidden = false,
  size = "medium",
  isFavourite = false,
  onToggleFavourite,
}) => {
  const { theme } = useThemeStore();
  const dims = CARD_DIMENSIONS[size];
  // AppShell-style transition; shared by every hover motion below.
  const transition = `${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut}`;
  // Normalise absolute / blob / backend-relative image URLs.
  const resolvedImageUrl = imageUrl ? prepareBackendLink(imageUrl) : undefined;
  // Avatar initials: first letter of each of the first two words,
  // else first two letters. Uppercased.
  const placeholderText = (() => {
    const trimmed = displayName.trim();
    if (trimmed.length === 0) return "?";
    const segments = trimmed.split(/\s+/);
    if (segments.length >= 2) {
      return (segments[0][0] + segments[1][0]).toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  })();

  if (hidden) {
    return null;
  }

  if (loading) {
    return (
      <Card
        variant="outlined"
        sx={{
          width: dims.width,
          height: dims.height,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Skeleton
          variant="rectangular"
          height={dims.imageHeight}
          animation="wave"
        />
        <CardContent sx={{ flex: 1 }}>
          <Skeleton variant="text" width="70%" animation="wave" />
          <Skeleton variant="text" width="50%" animation="wave" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      variant="outlined"
      sx={{
        width: dims.width,
        height: dims.height,
        display: "flex",
        flexDirection: "column",
        cursor: onClick ? "pointer" : "default",
        // Explicit per-property transitions (matches AppShell easing).
        transition: `transform ${transition}, box-shadow ${transition}, border-color ${transition}`,
        overflow: "hidden",
        // Cover re-frames 16:9 -> 3:2 on hover via aspect-ratio.
        // All source aspects snap to the same uniform crop.
        "&:hover .folder-card-image-cover": {
          aspectRatio: "3 / 2",
        },
        "& .folder-card-subtitle": {
          opacity: 1,
          maxHeight: 40,
          // Fade + slide-down + collapse together on hover.
          transition: `opacity ${transition}, max-height ${transition}, margin-top ${transition}, transform ${transition}`,
          transform: "translateY(0)",
        },
        "&:hover .folder-card-subtitle": {
          opacity: 0,
          maxHeight: 0,
          marginTop: 0,
          // Independent of max-height, so the slide keeps playing.
          transform: "translateY(20px)",
          pointerEvents: "none",
        },
        // Star pops in on hover (fade + scale + translateY lift).
        // Hidden + unclickable at rest so it doesn't intercept clicks.
        "& .folder-card-fav": {
          opacity: 0,
          transform: "scale(0.6) translateY(-4px)",
          pointerEvents: "none",
          transition: `opacity ${transition}, transform ${transition}, background-color ${transition}`,
        },
        "&:hover .folder-card-fav": {
          opacity: 1,
          transform: "scale(1) translateY(0)",
          pointerEvents: "auto",
        },
        "&:hover": onClick
          ? {
              transform: "scale(1.04)",
              boxShadow: theme.shadows[4],
              borderColor: blendWithContrast(
                theme.palette.primary.main,
                theme,
                1 / 2,
              ),
            }
          : undefined,
      }}
      onClick={onClick}
    >
      {/* Image area wraps cover/placeholder + star. No fixed height;
          the cover's `aspectRatio` drives the area. */}
      <Box
        className="folder-card-image"
        sx={{
          position: "relative",
          backgroundColor: blendWithContrast(
            theme.palette.primary.main,
            theme,
            3 / 4,
          ),
          // Soft black radial gradient anchored to the top-right
          // corner for the favourite star's backdrop. Hidden at
          // rest and fades in with the AppShell easing on hover,
          // in lockstep with the star's pop-in animation.
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            right: 0,
            width: "100%",
            height: "100%",
            background:
              "radial-gradient(circle at top right, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.3) 25%, rgba(0, 0, 0, 0) 38%)",
            pointerEvents: "none",
            zIndex: 1,
            opacity: 0,
            transition: `opacity ${transition}`,
          },
          "&:hover::before": {
            opacity: 1,
          },
        }}
      >
        {/* Cover or placeholder; both share the className so the
            hover `aspectRatio` rule applies uniformly. */}
        <Box
          className="folder-card-image-cover"
          sx={{
            width: "100%",
            aspectRatio: "16 / 9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            transition: `aspect-ratio ${transition}`,
            backgroundColor: blendWithContrast(
              theme.palette.primary.main,
              theme,
              1 / 2,
            ),
          }}
        >
          {resolvedImageUrl ? (
            <Box
              component="img"
              src={resolvedImageUrl}
              alt={`${displayName} cover`}
              sx={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: blendWithContrast(
                  theme.palette.primary.main,
                  theme,
                  1 / 4,
                ),
              }}
            >
              {placeholderText}
            </Typography>
          )}
        </Box>
        {/* Favourite star overlay; `stopPropagation` is caller's job.
            Backdrop lives on the image area's `::before`. */}
        {onToggleFavourite && (
          <IconButton
            className="folder-card-fav"
            size={dims.starIconSize}
            aria-label={
              isFavourite ? "Unfavourite directory" : "Favourite directory"
            }
            aria-pressed={isFavourite}
            onClick={onToggleFavourite}
            sx={{
              position: "absolute",
              top: 4,
              right: 4,
              // Sit above the image area's `::before` gradient
              // (zIndex: 1) so the star isn't dimmed by the halo.
              zIndex: 2,
            }}
          >
            {isFavourite ? <StarIcon /> : <StarBorderIcon />}
          </IconButton>
        )}
      </Box>
      <CardContent sx={{ p: dims.contentPadding }}>
        <Typography
          variant={dims.titleVariant}
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            mb: dims.titleBottomMargin,
          }}
        >
          {displayName}
        </Typography>
        {/* Subtitle slides down + fades on hover; cover re-frames
            to 3:2 at the same time. */}
        <Typography
          className="folder-card-subtitle"
          variant={dims.subtitleVariant}
          sx={{
            overflow: "hidden",
            color: blendWithContrast(theme.palette.text.primary, theme, 1 / 4),
          }}
        >
          {lastModified
            ? `Modified ${formatDistanceToNow(new Date(lastModified), {
                addSuffix: true,
              })}`
            : "No activity yet"}
        </Typography>
      </CardContent>
    </Card>
  );
};
