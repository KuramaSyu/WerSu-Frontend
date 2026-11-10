import { Box, Button, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import type { ShelfReply } from "../../api/models/shelf";
import { UpperPanel } from "../../components/Panels/UpperPanel";

export interface ShelfEditPanelProps {
  shelf: ShelfReply | null;
  isLoading: boolean;
  onBack: () => void;
}

/**
 * Left-rail anchor for the shelf page: name, slug, description and a
 * back-home action. Settings, rules and permissions are reached from
 * the tabs in the main object, not from here.
 */
export const ShelfEditPanel: React.FC<ShelfEditPanelProps> = ({
  shelf,
  isLoading,
  onBack,
}) => {
  return (
    <UpperPanel>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="overline" color="text.secondary">
            Shelf
          </Typography>
          <Typography variant="h6">
            {shelf?.display_name ?? "Loading..."}
          </Typography>
          {shelf?.slug !== undefined && (
            <Typography variant="caption" color="text.secondary">
              slug: {shelf.slug}
            </Typography>
          )}
        </Stack>

        {shelf?.description !== undefined && shelf.description !== "" && (
          <Typography variant="body2" color="text.secondary">
            {shelf.description}
          </Typography>
        )}

        <Divider />

        <Stack spacing={1}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon fontSize="small" />}
            onClick={onBack}
          >
            Back home
          </Button>
        </Stack>

        {isLoading ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              py: 2,
            }}
          >
            <CircularProgress size={20} />
          </Box>
        ) : null}
      </Stack>
    </UpperPanel>
  );
};
