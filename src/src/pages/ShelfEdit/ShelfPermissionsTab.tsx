import { Box, Paper, Stack, Typography } from "@mui/material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { PermissionMatrix } from "../../components/Permissions/PermissionMatrix";

export interface ShelfPermissionsTabProps {
  shelfId: string;
}

/**
 * Permissions panel for a shelf.
 *
 * Reuses the shared permission matrix in embedded mode so the shelf
 * owner can share it with users and roles without leaving the tabbed
 * shelf page.
 */
export const ShelfPermissionsTab: React.FC<ShelfPermissionsTabProps> = ({
  shelfId,
}) => {
  return (
    <Paper
      component="section"
      variant="outlined"
      elevation={0}
      sx={{ p: 3, borderRadius: 2, borderColor: "divider" }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "flex-start" }}
        >
          <Box sx={{ pt: 0.25, color: "primary.main" }}>
            <AdminPanelSettingsIcon fontSize="small" />
          </Box>
          <Stack spacing={0.5}>
            <Typography variant="h6">Permissions</Typography>
            <Typography variant="body2" color="text.secondary">
              Share this shelf with users or roles. Basic permissions are shown
              first; grant and delegate relations live under Advanced
              permissions.
            </Typography>
          </Stack>
        </Stack>

        {shelfId ? (
          <PermissionMatrix
            objectType="shelf"
            objectId={shelfId}
            embedded
          />
        ) : null}
      </Stack>
    </Paper>
  );
};

export default ShelfPermissionsTab;
