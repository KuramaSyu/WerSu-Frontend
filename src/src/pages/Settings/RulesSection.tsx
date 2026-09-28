import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useNavigate } from "react-router-dom";
import { useShelves } from "../../api/queries/shelfQueries";

// Settings section that lists every shelf and links into the
// per-shelf rules page.
export const RulesSection: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useShelves({});

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="body1">
          Manage automation rules per shelf. Each shelf has its own
          rules list scoped to it.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Rules fire only on events whose primary entity matches the
          shelf, or one of its descendants.
        </Typography>
      </Stack>

      {isLoading ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            py: 4,
          }}
        >
          <CircularProgress size={24} />
        </Box>
      ) : null}

      {isError ? (
        <Alert severity="error">
          {error instanceof Error ? error.message : "Failed to load shelves"}
        </Alert>
      ) : null}

      {data && data.length === 0 && !isLoading ? (
        <Alert severity="info">You have no shelves yet.</Alert>
      ) : null}

      {data && data.length > 0 ? (
        <List disablePadding>
          {data.map((shelf) => (
            <ListItem key={shelf.id} divider>
              <ListItemText
                primary={shelf.display_name ?? shelf.slug ?? shelf.id}
                secondary={shelf.id}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  aria-label={`manage rules for ${shelf.display_name ?? shelf.id}`}
                  onClick={() => navigate(`/shelves/${shelf.id}/rules`)}
                >
                  <OpenInNewIcon />
                </IconButton>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate(`/shelves/${shelf.id}/rules`)}
                  sx={{ ml: 1 }}
                >
                  Manage rules
                </Button>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      ) : null}
    </Stack>
  );
};
