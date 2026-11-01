import { Box, Button, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RuleFolderIcon from "@mui/icons-material/RuleFolder";
import type { ShelfReply } from "../../api/models/shelf";
import { UpperPanel } from "../../components/Panels/UpperPanel";

export interface ShelfEditPanelProps {
  shelf: ShelfReply | null;
  isLoading: boolean;
  onBack: () => void;
  onOpenRules: () => void;
}

/** Left-rail anchor for the shelf edit page: name, slug, and links. */
export const ShelfEditPanel: React.FC<ShelfEditPanelProps> = ({
  shelf,
  isLoading,
  onBack,
  onOpenRules,
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
          <Button
            variant="outlined"
            startIcon={<RuleFolderIcon fontSize="small" />}
            onClick={onOpenRules}
          >
            Rules
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
