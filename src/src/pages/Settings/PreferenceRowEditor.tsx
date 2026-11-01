import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import CodeMirror from "@uiw/react-codemirror";
import { loadLanguage } from "@uiw/codemirror-extensions-langs";

import type { PreferenceScope } from "../../api/models/preferences";
import {
  useDeletePreferences,
  usePreferences,
  useReplacePreferences,
} from "../../api/queries/preferencesQueries";

// Resolve the JSON language extension from the declared `extensions-langs`
// dependency (avoids importing `@codemirror/lang-json`, which is only a
// transitive dep). Computed once at module load.
const jsonLanguage = loadLanguage("json");
const jsonExtensions = jsonLanguage ? [jsonLanguage] : [];

/** Decode a stored `preferences_json` value into displayable JSON. */
function decodeStored(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return {};
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value ?? {};
}

export interface PreferenceRowEditorProps {
  /** Scope the row lives under. */
  scope: PreferenceScope;
  /** Id of the user/shelf/role the row belongs to. */
  targetId: string;
  /** Sub-key; omit for the default row. */
  prefKey?: string;
  /** Human-readable row label (e.g. "default", "custom-themes"). */
  label: string;
}

/**
 * Developer tool: view/edit/delete a single `/api/preferences` row.
 *
 * The blob is fetched with `usePreferences` and pretty-printed into a
 * CodeMirror JSON editor. "Save" replaces the row wholesale via
 * `useReplacePreferences`; "Delete" drops it via `useDeletePreferences`;
 * "Reload" refetches. Backs the "All preferences" developer accordion.
 */
export const PreferenceRowEditor: React.FC<PreferenceRowEditorProps> = ({
  scope,
  targetId,
  prefKey,
  label,
}) => {
  const muiTheme = useTheme();
  const { data, isLoading, isError, error, refetch, isFetching } =
    usePreferences({ scope, target_id: targetId, key: prefKey });
  const replace = useReplacePreferences();
  const remove = useDeletePreferences();

  // Pretty-printed canonical blob currently stored on the server. The API
  // transports `preferences_json` as a JSON-encoded string.
  const storedJson = useMemo(
    () => JSON.stringify(decodeStored(data?.preferences_json), null, 2),
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

  const canSave = targetId.length > 0 && dirty && parseError === null;

  const handleSave = () => {
    if (!canSave || parseError !== null) {
      return;
    }
    const parsed = JSON.parse(draft) as unknown;
    replace.mutate({
      scope,
      target_id: targetId,
      ...(prefKey !== undefined ? { key: prefKey } : {}),
      // The API expects the payload as a JSON-encoded string.
      preferences_json: JSON.stringify(parsed),
    });
  };

  const handleDelete = () => {
    remove.mutate({
      scope,
      target_id: targetId,
      ...(prefKey !== undefined ? { key: prefKey } : {}),
    });
  };

  const pending = replace.isPending || remove.isPending;

  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        p: 2,
      }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
            <Typography variant="subtitle2">{label}</Typography>
            <Typography variant="caption" color="text.secondary">
              {scope} · {targetId}
              {prefKey !== undefined ? ` · key: ${prefKey}` : " · (default)"}
            </Typography>
          </Stack>
          <Tooltip title="Delete this row">
            <span>
              <IconButton
                size="small"
                aria-label={`Delete ${scope} ${label} preferences`}
                onClick={handleDelete}
                disabled={pending || targetId.length === 0}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
            <CircularProgress size={20} />
          </Box>
        ) : isError ? (
          <Alert severity="error">
            Failed to load:{" "}
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
            {remove.isError && (
              <Alert severity="error">
                Delete failed:{" "}
                {remove.error instanceof Error
                  ? remove.error.message
                  : String(remove.error)}
              </Alert>
            )}
            {replace.isSuccess && !dirty && (
              <Alert severity="success">Preferences saved.</Alert>
            )}
          </>
        )}

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            size="small"
            disabled={!canSave || pending}
            onClick={handleSave}
          >
            Save
          </Button>
          <Button
            variant="outlined"
            size="small"
            disabled={!dirty || pending}
            onClick={() => setEdit(null)}
          >
            Reset
          </Button>
          <Button
            variant="text"
            size="small"
            disabled={isFetching || targetId.length === 0}
            onClick={() => void refetch()}
          >
            Reload
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};
