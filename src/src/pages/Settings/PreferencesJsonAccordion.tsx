import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CodeMirror from "@uiw/react-codemirror";
import { loadLanguage } from "@uiw/codemirror-extensions-langs";

import {
  usePreferences,
  useReplacePreferences,
} from "../../api/queries/preferencesQueries";
import {
  parseStoredPreferences,
  type PreferencesData,
} from "../../models/Preferences";
import { useUserStore } from "../../zustand/userStore";

// Resolve the JSON language extension from the declared `extensions-langs`
// dependency (avoids importing `@codemirror/lang-json`, which is only a
// transitive dep). Computed once at module load.
const jsonLanguage = loadLanguage("json");
const jsonExtensions = jsonLanguage ? [jsonLanguage] : [];

/**
 * Developer tool: a collapsible, editable view of the complete cloud
 * preferences JSON blob (`/api/preferences`, `scope: "user"`).
 *
 * The blob is fetched with `usePreferences` and pretty-printed into a
 * CodeMirror JSON editor. "Save" replaces the stored blob wholesale via
 * `useReplacePreferences`; "Reset" restores the last fetched value. The
 * editor is intentionally generic so future preference keys show up here
 * without code changes.
 *
 * Only exposed from the Developer settings section.
 */
export const PreferencesJsonAccordion: React.FC = () => {
  const muiTheme = useTheme();
  const userId = useUserStore((s) => s.user?.id ?? null);

  const { data, isLoading, isError, error, refetch, isFetching } =
    usePreferences({ scope: "user", target_id: userId ?? "" });
  const replace = useReplacePreferences();

  // Pretty-printed canonical blob currently stored on the server. The API
  // transports `preferences_json` as a JSON-encoded string; decode it back
  // to an object so the editor shows formatted JSON without outer quotes.
  const storedJson = useMemo(
    () =>
      JSON.stringify(
        parseStoredPreferences(data?.preferences_json) ?? {},
        null,
        2,
      ),
    [data],
  );

  // Editor state. `edit` captures the user's in-progress text together
  // with the `storedJson` it was based on, so an incoming refetch (new
  // `storedJson`) discards the stale draft without an effect.
  const [edit, setEdit] = useState<{ base: string; value: string } | null>(
    null,
  );
  const draft =
    edit !== null && edit.base === storedJson ? edit.value : storedJson;
  const dirty =
    edit !== null && edit.base === storedJson && edit.value !== storedJson;

  // Null while the draft is valid JSON, otherwise a human-readable error.
  const parseError = useMemo(() => {
    try {
      JSON.parse(draft);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }, [draft]);

  const canSave = userId !== null && dirty && parseError === null;

  const handleSave = () => {
    if (userId === null || parseError !== null) {
      return;
    }
    const parsed = JSON.parse(draft) as PreferencesData;
    replace.mutate({
      scope: "user",
      target_id: userId,
      // The API expects the payload as a JSON-encoded string.
      preferences_json: JSON.stringify(parsed),
    });
  };

  return (
    <Accordion disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">Preferences JSON</Typography>
      </AccordionSummary>
      <AccordionDetails>
        {userId === null ? (
          <Alert severity="info">
            Sign in to inspect and edit your cloud preferences.
          </Alert>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              The complete <code>{`{ version, theme, … }`}</code> payload stored
              under <code>scope: "user"</code>. Saving replaces the blob
              wholesale.
            </Typography>

            {isLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                <CircularProgress size={20} />
              </Box>
            ) : isError ? (
              <Alert severity="error">
                Failed to load preferences:{" "}
                {error instanceof Error ? error.message : String(error)}
              </Alert>
            ) : (
              <>
                <Box
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    overflow: "hidden",
                  }}
                >
                  <CodeMirror
                    value={draft}
                    onChange={(value) => setEdit({ base: storedJson, value })}
                    extensions={jsonExtensions}
                    theme={muiTheme.palette.mode === "dark" ? "dark" : "light"}
                    basicSetup={{ lineNumbers: true, foldGutter: true }}
                  />
                </Box>

                {parseError !== null && (
                  <Alert severity="warning">Invalid JSON: {parseError}</Alert>
                )}

                {replace.isError && (
                  <Alert severity="error">
                    Save failed:{" "}
                    {replace.error instanceof Error
                      ? replace.error.message
                      : String(replace.error)}
                  </Alert>
                )}
                {replace.isSuccess && !dirty && (
                  <Alert severity="success">Preferences saved.</Alert>
                )}
              </>
            )}

            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Button
                variant="contained"
                size="small"
                disabled={!canSave || replace.isPending}
                onClick={handleSave}
              >
                Save
              </Button>
              <Button
                variant="outlined"
                size="small"
                disabled={!dirty || replace.isPending}
                onClick={() => setEdit(null)}
              >
                Reset
              </Button>
              <Button
                variant="text"
                size="small"
                disabled={isFetching}
                onClick={() => void refetch()}
              >
                Reload
              </Button>
            </Stack>
          </Stack>
        )}
      </AccordionDetails>
    </Accordion>
  );
};
