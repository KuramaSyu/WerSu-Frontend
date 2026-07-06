import { Box, Card, CardContent, Skeleton, Typography } from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import { formatDistanceToNow } from "date-fns";
import { useThemeStore } from "../../zustand/useThemeStore";
import { blendWithContrast } from "../../utils/blendWithContrast";

/** Visual size preset for the card; resolved to concrete dimensions below. */
export type CardSize = "small" | "medium" | "large";

interface CardDimensions {
  width: number;
  height: number;
  imageHeight: number;
  iconSize: number;
  titleVariant: "h5" | "h6" | "subtitle1" | "subtitle2";
  subtitleVariant: "body2" | "caption";
  // CardContent padding + the bottom margin under the title. Smaller
  // cards use tighter padding so the title/subtitle don't crush against
  // the image; larger cards step up to match the bigger type.
  contentPadding: string;
  titleBottomMargin: string;
}

// Concrete dimensions per `CardSize`. The Home page renders favourites at
// `medium` and the full directory list at `small`; `large` is reserved
// for hero spots where the card needs more breathing room.
const CARD_DIMENSIONS: Record<CardSize, CardDimensions> = {
  small: {
    width: 160,
    height: 150,
    imageHeight: 80,
    iconSize: 32,
    titleVariant: "subtitle1",
    subtitleVariant: "caption",
    contentPadding: "0.375rem",
    titleBottomMargin: "0.125rem",
  },
  medium: {
    width: 220,
    height: 200,
    imageHeight: 120,
    iconSize: 48,
    titleVariant: "h6",
    subtitleVariant: "caption",
    contentPadding: "0.5rem",
    titleBottomMargin: "0.25rem",
  },
  large: {
    width: 300,
    height: 260,
    imageHeight: 160,
    iconSize: 64,
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
   * Most recent activity timestamp in ISO 8601 format. When set, the card
   * renders "Modified <relative time>"; when omitted it renders
   * "No activity yet".
   */
  imageUrl?: string;
  lastModified?: string;
  /** When true, render the skeleton placeholder instead of the populated card. */
  loading?: boolean;
  /** Hide the card entirely (e.g. when the underlying directory is missing). */
  hidden?: boolean;
  /** Visual size preset; defaults to `medium`. */
  size?: CardSize;
}

/**
 * Pure presentation for a single favourite directory card.
 *
 * No data fetching, no store hooks, no navigation logic - the feature
 * component (`FolderCard`) resolves those and passes resolved values as
 * props here. Image placeholder lives where the real `<CardMedia>` will
 * land once the directory backend exposes cover images.
 */
export const FolderCardView: React.FC<FolderCardViewProps> = ({
  displayName,
  onClick,
  lastModified,
  imageUrl = undefined,
  loading = false,
  hidden = false,
  size = "medium",
}) => {
  const { theme } = useThemeStore();
  const dims = CARD_DIMENSIONS[size];

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
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease-in-out",
        overflow: "hidden",
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
      {imageUrl ? (
        <Box
          component="img"
          src={imageUrl}
          alt={`${displayName} cover`}
          sx={{
            width: "100%",
            height: dims.imageHeight,
            objectFit: "cover",
            display: "block",
            backgroundColor: blendWithContrast(
              theme.palette.primary.main,
              theme,
              3 / 4,
            ),
          }}
        />
      ) : (
        <Box
          sx={{
            height: dims.imageHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: blendWithContrast(
              theme.palette.primary.main,
              theme,
              3 / 4,
            ),
          }}
        >
          <FolderIcon
            sx={{
              fontSize: dims.iconSize,
              color: blendWithContrast(
                theme.palette.primary.main,
                theme,
                1 / 4,
              ),
            }}
          />
        </Box>
      )}
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
        <Typography
          variant={dims.subtitleVariant}
          sx={{
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
