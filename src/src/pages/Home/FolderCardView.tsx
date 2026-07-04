import { Box, Card, CardContent, Skeleton, Typography } from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import { formatDistanceToNow } from "date-fns";
import { M1, M2 } from "../../statics";
import { useThemeStore } from "../../zustand/useThemeStore";
import { blendWithContrast } from "../../utils/blendWithContrast";

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
  lastModified?: string;
  /** When true, render the skeleton placeholder instead of the populated card. */
  loading?: boolean;
  /** Hide the card entirely (e.g. when the underlying directory is missing). */
  hidden?: boolean;
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
  loading = false,
  hidden = false,
}) => {
  const { theme } = useThemeStore();

  if (hidden) {
    return null;
  }

  if (loading) {
    return (
      <Card
        variant="outlined"
        sx={{
          width: 220,
          height: 200,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Skeleton variant="rectangular" height={120} animation="wave" />
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
        width: 220,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease-in-out",
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
      {/* Image placeholder. Replace with <CardMedia image={...} /> once
          the directory backend exposes cover images. */}
      <Box
        sx={{
          height: 120,
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
            fontSize: 48,
            color: blendWithContrast(theme.palette.primary.main, theme, 1 / 4),
          }}
        />
      </Box>
      <CardContent sx={{ p: M2 }}>
        <Typography
          variant="h6"
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            mb: M1,
          }}
        >
          {displayName}
        </Typography>
        <Typography
          variant="caption"
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
