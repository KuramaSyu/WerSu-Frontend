// Per-note spell check settings.
//
// Off by default. Enabling it asks for a language, which is stored in
// the note's own preference row; nothing loads until it is enabled.

import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import {
  SPELLCHECK_LANGUAGES,
  type SpellcheckLanguage,
} from "../../spellcheck/dictionary";
import {
  SPELLCHECK_PREFERENCE_VERSION,
  type SpellcheckPreference,
} from "../../api/models/spellcheck";
import { useSpellcheckPreference } from "../../hooks/useSpellcheckPreference";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";

export interface SpellcheckDialogProps {
  open: boolean;
  noteId?: string;
  onClose: () => void;
}

interface SpellcheckFormProps {
  preference: SpellcheckPreference;
  save: (preference: SpellcheckPreference) => Promise<void>;
  saving: boolean;
  error: string | null;
  onClose: () => void;
}

/**
 * The form body. Mounted fresh each time the dialog opens (and only
 * once the stored preference is known), so its draft state never
 * needs to be re-synced from props.
 */
const SpellcheckForm: React.FC<SpellcheckFormProps> = ({
  preference,
  save,
  saving,
  error,
  onClose,
}) => {
  const setMessage = useInfoStore((s) => s.setMessage);
  const [enabled, setEnabled] = useState(preference.enabled);
  // null until the user picks a language for a newly enabled note.
  const [language, setLanguage] = useState<SpellcheckLanguage | null>(
    preference.enabled ? preference.language : null,
  );

  const canSave = !enabled || language !== null;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      await save({
        version: SPELLCHECK_PREFERENCE_VERSION,
        enabled,
        language: language ?? preference.language,
      });
      setMessage(
        new SnackbarUpdateImpl(
          enabled ? "Spell check enabled for this note" : "Spell check disabled",
          "success",
        ),
      );
      onClose();
    } catch {
      // The inline alert below shows the mutation error.
    }
  };

  return (
    <>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Spell check runs in the browser and is stored for this note only.
            A language has to be loaded the first time it is enabled.
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                disabled={saving}
              />
            }
            label="Enable spell check"
          />

          <FormControl fullWidth disabled={!enabled || saving}>
            <InputLabel id="spellcheck-language-label">Language</InputLabel>
            <Select
              labelId="spellcheck-language-label"
              label="Language"
              value={language ?? ""}
              onChange={(event) =>
                setLanguage(event.target.value as SpellcheckLanguage)
              }
            >
              {SPELLCHECK_LANGUAGES.map((entry) => (
                <MenuItem key={entry.value} value={entry.value}>
                  {entry.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {enabled && language === null && (
            <Typography variant="caption" color="text.secondary">
              Pick a language to apply spell check to this note.
            </Typography>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={saving || !canSave}
        >
          Save
        </Button>
      </DialogActions>
    </>
  );
};

export const SpellcheckDialog: React.FC<SpellcheckDialogProps> = ({
  open,
  noteId,
  onClose,
}) => {
  const { preference, loaded, save, saving, error } =
    useSpellcheckPreference(noteId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Spellcheck</DialogTitle>
      {open && loaded && (
        <SpellcheckForm
          key={noteId ?? ""}
          preference={preference}
          save={save}
          saving={saving}
          error={error}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
};

export default SpellcheckDialog;