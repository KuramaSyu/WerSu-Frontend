// Per-note spell-check preference, as consumed by the editor.
//
// The API lives behind `SpellcheckApi` (default:
// `SpellcheckWithPreferencesApi`) and is read/written through the
// TanStack hooks in `api/queries/spellcheckQueries`. This file maps
// those to the shape the editor UI needs (defaulted preference plus a
// save callback).

import { useCallback, useMemo } from "react";
import {
  useSetSpellcheckPreference,
  useSpellcheckPreferenceQuery,
} from "../api/queries/spellcheckQueries";
import {
  DEFAULT_SPELLCHECK_PREFERENCE,
  type SpellcheckPreference,
} from "../api/models/spellcheck";
import { useUserStore } from "../zustand/userStore";

export interface SpellcheckPreferenceController {
  preference: SpellcheckPreference;
  /** False until the row (or its absence) is known. */
  loaded: boolean;
  save: (preference: SpellcheckPreference) => Promise<void>;
  saving: boolean;
  error: string | null;
}

/**
 * Read and write the active note's spell-check preference. Writes go
 * through the API layer, which PATCH-merges the note's keyed row.
 */
export function useSpellcheckPreference(
  noteId: string | undefined,
): SpellcheckPreferenceController {
  const userId = useUserStore((s) => s.user?.id ?? null);
  const target = useMemo(
    () => ({ userId: userId ?? "", noteId: noteId ?? "" }),
    [userId, noteId],
  );

  const query = useSpellcheckPreferenceQuery(target);
  const mutation = useSetSpellcheckPreference();

  const preference = query.data ?? DEFAULT_SPELLCHECK_PREFERENCE;

  const save = useCallback(
    async (next: SpellcheckPreference) => {
      if (!noteId || !userId) return;
      await mutation.mutateAsync({ userId, noteId, preference: next });
    },
    [mutation, noteId, userId],
  );

  return {
    preference,
    loaded: !query.isLoading,
    save,
    saving: mutation.isPending,
    error: mutation.error instanceof Error ? mutation.error.message : null,
  };
}