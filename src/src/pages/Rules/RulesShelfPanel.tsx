import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import type { ShelfReply } from "../../api/models/shelf";
import { UpperPanel } from "../../components/Panels/UpperPanel";

export interface RulesShelfPanelProps {
  // Loaded shelf details. null while loading or on error.
  shelf: ShelfReply | null;
  isLoading: boolean;
  onBack: () => void;
}

// Left-rail content for the rules page.
// Renders the shelf anchor (name, description, back button) and a
// loading hint while the shelf details are in flight.
export const RulesShelfPanel: React.FC<RulesShelfPanelProps> = ({
  shelf,
  isLoading,
  onBack,
}) => {
  return (
    <UpperPanel>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="overline" color="text.secondary">
            Shelf scope
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

        <Stack direction="row" spacing={1}>
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
