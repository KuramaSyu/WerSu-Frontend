import { ButtonBase, Stack, Typography } from "@mui/material";
import type { HirarchyItem } from "../../models/HirarchyItem";

export interface DirectoryBreadCrumbsProps {
  path: HirarchyItem[];
  onNavigate: (id: string) => void;
}

/**
 * Renders the directory breadcrumb trail.
 *
 * Each segment is a clickable button that navigates to that directory via
 * `onNavigate`. Segments are joined by a chevron separator.
 */
export const DirectoryBreadCrumbs: React.FC<DirectoryBreadCrumbsProps> = ({
  path,
  onNavigate,
}) => {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      {path.map((segment, index) => (
        <Stack
          key={segment.getId()}
          direction="row"
          spacing={1}
          sx={{ alignItems: "center" }}
        >
          <ButtonBase
            onClick={() => onNavigate(segment.getId())}
            sx={{
              borderRadius: 1,
              px: 0.5,
              py: 0.25,
              "&:hover": {
                backgroundColor: "action.hover",
              },
            }}
          >
            <Typography variant="body2" color="textSecondary">
              {segment.getName()}
            </Typography>
          </ButtonBase>
          {index < path.length - 1 && (
            <Typography variant="body2" color="textSecondary">
              ›
            </Typography>
          )}
        </Stack>
      ))}
    </Stack>
  );
};
