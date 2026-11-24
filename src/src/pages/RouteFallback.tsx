import { Box, CircularProgress } from "@mui/material";

/**
 * Suspense fallback for lazily-loaded route chunks.
 *
 * Deliberately dependency-free so it renders instantly while the
 * route's chunk (editor stack, swagger-ui, graph, ...) is fetched.
 */
export const RouteFallback: React.FC = () => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      minHeight: "50vh",
    }}
  >
    <CircularProgress size={28} />
  </Box>
);
