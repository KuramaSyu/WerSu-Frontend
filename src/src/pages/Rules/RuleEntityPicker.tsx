// RuleEntityPicker
//
// Single-select autocomplete that lets the user pick a shelf /
// directory / note / tag by name and emits the resource id. The
// picker is deliberately constrained to existing entities (no free
// solo typing) so a user can never save an unknown id by accident.
// When the current value resolves to a known entity, the chip
// label shows the display name; when the value does not resolve
// (id is from a different shelf scope, or its source hasn't been
// fetched yet), the picker renders a stub option showing the raw
// id so the existing selection is still visible while data loads.

import { useMemo } from "react";
import { Autocomplete, Stack, TextField } from "@mui/material";
import type { DirectoryReply } from "../../api/models/directory";
import type { ShelfReply } from "../../api/models/shelf";
import type { MinimalNote, MinimalTag } from "../../api/models/search";
import { useAllDirectoriesQuery } from "../../api/queries/directoryQueries";
import { useShelves } from "../../api/queries/shelfQueries";
import { useLatestNotes } from "../../api/queries/useNoteQueries";
import { useTagStore } from "../../zustand/useTagStore";
import { disambiguateLabels } from "../../utils/disambiguateLabels";

// Discriminated union of every selectable option across the four
// supported entity kinds. Each variant carries its concrete record
// (or a stub when the id isn't backed by a loaded entity) plus the
// shared `id` field that the form persists.
export type RuleEntityOption =
  | { kind: "shelf"; record: ShelfReply; id: string }
  | { kind: "directory"; record: DirectoryReply; id: string }
  | { kind: "note"; record: MinimalNote; id: string }
  | { kind: "tag"; record: MinimalTag; id: string };

export type RuleEntityKind = RuleEntityOption["kind"];

// Display label for a shelf, with a stable fallback chain.
const labelOfShelf = (shelf: ShelfReply): string =>
  shelf.display_name ?? shelf.slug ?? shelf.id;

// Display label for a directory, with a stable fallback chain.
const labelOfDirectory = (directory: DirectoryReply): string =>
  directory.display_name ?? directory.name ?? directory.slug ?? directory.id;

// Display label for a note; notes always carry a title.
const labelOfNote = (note: MinimalNote): string => note.title || note.id;

// Display label for a tag, with a stable fallback chain.
const labelOfTag = (tag: MinimalTag): string =>
  tag.display_name ?? tag.slug ?? tag.id;

const baseLabelOf = (option: RuleEntityOption): string => {
  switch (option.kind) {
    case "shelf":
      return labelOfShelf(option.record);
    case "directory":
      return labelOfDirectory(option.record);
    case "note":
      return labelOfNote(option.record);
    case "tag":
      return labelOfTag(option.record);
  }
};

// First-pass disambiguation id. Each entity kind has a different
// "natural" secondary label - shelf uses slug, directory uses its
// first shelf binding, note/tag fall back to id.
const firstIdOf = (option: RuleEntityOption): string => {
  switch (option.kind) {
    case "shelf":
      return option.record.slug ?? option.record.id;
    case "directory":
      return option.record.shelf_ids?.[0] ?? option.record.id;
    case "note":
    case "tag":
      return option.id;
  }
};

const secondIdOf = (option: RuleEntityOption): string => option.id;

const sameId = (a: RuleEntityOption, b: RuleEntityOption): boolean =>
  a.id === b.id;

export interface RuleEntityPickerProps {
  /** Resource family backing the picker. */
  kind: RuleEntityKind;
  /** Currently selected id. Empty string means "nothing picked". */
  value: string;
  /** Called with the next id (or empty string when cleared). */
  onChange: (id: string) => void;
  /** Input label rendered above the search box. */
  label: string;
  /** Helper text rendered under the box. */
  helperText?: string;
  /** Marks the field as invalid for the form's submit guard. */
  error?: boolean;
  /** Forwarded to the underlying TextField so it can shrink. */
  size?: "small" | "medium";
}

// Picker used by RuleFormFields so the user picks shelf /
// directory / note / tag by name. The component never lets the
// user type an id; selection is constrained to loaded options plus
// a synthetic stub for the current value when its source isn't yet
// available.
export const RuleEntityPicker: React.FC<RuleEntityPickerProps> = ({
  kind,
  value,
  onChange,
  label,
  helperText,
  error,
  size = "small",
}) => {
  const options = useEntityOptions(kind);

  // Disambiguate duplicate names. The picker accepts both real
  // records and stub options; stubs share the disambiguator so an
  // id-only label can be promoted to "label (id)" when needed.
  const disambiguated = useMemo(
    () =>
      disambiguateLabels(options, baseLabelOf, firstIdOf, secondIdOf),
    [options],
  );
  const getOptionLabel = (option: RuleEntityOption): string =>
    disambiguated.get(option) ?? baseLabelOf(option);

  // Resolve the current selection. If the loaded list already has
  // it, use the real record; otherwise build a stub so the chip
  // stays visible until the source query lands.
  const selected: RuleEntityOption | null = useMemo(() => {
    if (value === "") {
      return null;
    }
    const hit = options.find((option) => option.id === value);
    if (hit) {
      return hit;
    }
    return buildStub(kind, value);
  }, [options, value, kind]);

  return (
    <Stack>
      <Autocomplete<RuleEntityOption, false, false, false>
        options={options}
        value={selected}
        onChange={(_event, next) => onChange(next?.id ?? "")}
        getOptionLabel={getOptionLabel}
        isOptionEqualToValue={sameId}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder={placeholderFor(kind)}
            error={error}
            helperText={helperText}
            size={size}
          />
        )}
      />
    </Stack>
  );
};

// Builds the option pool for one entity kind. Each branch hydrates
// its own data source; the returned array mixes real records only.
// Stubs are produced inside `RuleEntityPicker` so the same shape
// shows up across all kinds.
function useEntityOptions(kind: RuleEntityKind): RuleEntityOption[] {
  const shelvesQuery = useShelves({}, { enabled: kind === "shelf" });
  const directoriesQuery = useAllDirectoriesQuery(kind === "directory");
  const notesQuery = useLatestNotes();
  const tagsById = useTagStore((s) => s.tagsById);

  switch (kind) {
    case "shelf": {
      const shelves = shelvesQuery.data ?? [];
      return shelves.map((record) => ({ kind, record, id: record.id }));
    }
    case "directory": {
      const directories = directoriesQuery.list ?? [];
      return directories.map((record) => ({ kind, record, id: record.id }));
    }
    case "note": {
      const notes = notesQuery.data ?? [];
      return notes.map((record) => ({ kind, record, id: record.id }));
    }
    case "tag": {
      const tags = Object.values(tagsById);
      return tags.map((record) => ({ kind, record, id: record.id }));
    }
  }
}

// Synthesises a stub option for ids the picker can't resolve yet
// (e.g. an existing rule whose shelf hasn't been fetched into the
// local shelves cache). The stub renders as a chip showing the raw
// id so the user still sees what is selected.
function buildStub(kind: RuleEntityKind, id: string): RuleEntityOption {
  switch (kind) {
    case "shelf":
      return {
        kind,
        id,
        record: { id },
      };
    case "directory":
      return {
        kind,
        id,
        record: {
          id,
          parent_dir_ids: [],
          child_dir_ids: [],
          child_note_ids: [],
          shelf_ids: [],
        },
      };
    case "note":
      return {
        kind,
        id,
        record: {
          id,
          title: "",
          author_id: "",
          updated_at: "",
          stripped_content: "",
          directory_ids: [],
          tag_ids: [],
        },
      };
    case "tag":
      return { kind, id, record: { id } };
  }
}

function placeholderFor(kind: RuleEntityKind): string {
  switch (kind) {
    case "shelf":
      return "Pick a shelf";
    case "directory":
      return "Pick a directory";
    case "note":
      return "Pick a note";
    case "tag":
      return "Pick a tag";
  }
}