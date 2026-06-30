import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { M3 } from "../../statics";
import { useThemeStore } from "../../zustand/useThemeStore";
import {
  extractError,
  formatPayload,
  statusChipSeverity,
  statusTitle,
  type ExtractedError,
} from "./PublicShareUnavailable.utils";

/**
 * Rendered when the public-share grant or the underlying note can't
 * be loaded. Catches every non-happy-path: grant rejected, grant
 * missing `note_id`, `useNote` rejected, unexpected `permission`,
 * 401 / 5xx (the previous version buried the HTTP status in a
 * collapsed Accordion, making "not logged in" indistinguishable
 * from a real 404). The title now drives off the HTTP status; the
 * raw payload disclosure stays for support / debugging.
 *
 * Pure helpers live in the sibling `.utils.ts` so this `.tsx` only
 * exports the component - required by `react-refresh`.
 */
export interface PublicShareUnavailableProps {
  /**
   * Raw error from the failing query (`usePublicShare` or `useNote`).
   *
   * When this is an `ApiError` (the `requestJson` helper throws one
   * on non-2xx responses), the HTTP status + JSON payload drive the
   * title and the raw-payload disclosure. Any other error type falls
   * back to a generic "Request failed" title.
   */
  error?: unknown;
  /**
   * Optional fallback reason. Used when `error` is not an `Error`
   * instance (e.g. `null` or a bare string) and we still want to
   * show *some* context in the friendly message.
   */
  reason?: string;
}

export const PublicShareUnavailable: React.FC<PublicShareUnavailableProps> = ({
  error,
  reason,
}) => {
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const extracted: ExtractedError = extractError(error, reason);
  // Raw payload disclosure - collapsed by default so the page stays
  // tidy, but available for support / debugging.
  const [showRaw, setShowRaw] = useState(false);
  const hasPayload =
    extracted.payload !== undefined &&
    // Skip the disclosure when payload duplicates the message we
    // already show (avoids a duplicate panel).
    formatPayload(extracted.payload) !== extracted.message;

  // Severity drives off status: 5xx -> error, 4xx -> warning,
  // everything else -> info (network down, parse failure, etc.).
  const alertSeverity: "error" | "warning" | "info" =
    extracted.status !== undefined && extracted.status >= 500
      ? "error"
      : extracted.status !== undefined &&
          extracted.status >= 400 &&
          extracted.status < 500
        ? "warning"
        : "info";

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: M3,
      }}
    >
      <Paper
        elevation={1}
        sx={{
          maxWidth: 640,
          width: "100%",
          p: M3,
          display: "flex",
          flexDirection: "column",
          gap: M3,
        }}
      >
        {/*
          Status + human title go in the AlertTitle so the user sees
          "401 - Not authenticated" without clicking anything
          (previous version hid the status in a collapsed Accordion).
        */}
        <Alert severity={alertSeverity} variant="outlined">
          <AlertTitle>
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              {extracted.status !== undefined && (
                <Chip
                  size="small"
                  label={`HTTP ${extracted.status}`}
                  color={statusChipSeverity(extracted.status)}
                  variant="filled"
                  data-testid="share-error-status-chip"
                />
              )}
              <Typography
                component="span"
                variant="h6"
                sx={{ fontWeight: 600 }}
              >
                {extracted.status !== undefined
                  ? statusTitle(extracted.status)
                  : "Request failed"}
              </Typography>
            </Stack>
          </AlertTitle>
          {extracted.message !== "Unknown error" && (
            <Typography
              variant="body2"
              color="text.secondary"
              data-testid="share-error-message"
            >
              {extracted.message}
            </Typography>
          )}
        </Alert>

        {hasPayload && (
          <>
            <Divider />
            <Accordion
              disableGutters
              elevation={0}
              expanded={showRaw}
              onChange={(_, isExpanded) => setShowRaw(isExpanded)}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                "&:before": { display: "none" },
              }}
              data-testid="share-error-raw-disclosure"
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="share-error-raw-content"
                id="share-error-raw-header"
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Show raw response body
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Collapse in={showRaw}>
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      p: 1.25,
                      borderRadius: 1,
                      backgroundColor: "action.hover",
                      border: "1px solid",
                      borderColor: "divider",
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      maxHeight: 240,
                      overflow: "auto",
                    }}
                  >
                    {formatPayload(extracted.payload)}
                  </Box>
                </Collapse>
              </AccordionDetails>
            </Accordion>
          </>
        )}

        <Stack direction="row" spacing={theme.spacing(1)}>
          <Button variant="contained" onClick={() => navigate("/")}>
            Back to home
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};
