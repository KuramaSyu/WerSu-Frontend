// ruleFormShared.ts -- constants and small helpers shared by the
// rule create and edit forms.

import type { RuleActionType, RuleConditionType } from "../../api/models/rule";

// Selectable values for the condition.type dropdown.
export const CONDITION_TYPE_OPTIONS: ReadonlyArray<RuleConditionType> = [
  "always_true",
  "note_content_contains",
  "note_title_contains",
];

// Selectable values for the action_type dropdown.
export const ACTION_TYPE_OPTIONS: ReadonlyArray<RuleActionType> = [
  "add_to_directory",
  "add_tag",
];

// Human-readable label per condition type.
export const CONDITION_TYPE_LABEL: Record<RuleConditionType, string> = {
  always_true: "Always true",
  note_content_contains: "Note content contains",
  note_title_contains: "Note title contains",
};

// Human-readable label per action type.
export const ACTION_TYPE_LABEL: Record<RuleActionType, string> = {
  add_to_directory: "Add note to directory",
  add_tag: "Add tag to note",
};

// "When" clause per event_type - the opening sentence of the
// rule's trigger description. Backend rejects anything outside
// its supported event set, so the dropdown only offers the four
// values the rules service accepts.
export const EVENT_TYPE_WHEN_LABEL: Record<string, string> = {
  NoteCreated: "a note was created",
  NoteUpdated: "a note was updated",
  DirectoryCreated: "a directory was created",
  DirectoryUpdated: "a directory was updated",
};

// Returns the canonical event_type for the dropdown default.
// Unknown values pass through untouched so the UI can flag them.
export function normalizeEventType(eventType: string | undefined): string {
  return eventType ?? "NoteCreated";
}

// Resolve an event_type into its "When" sentence. Returns null
// when the event_type is empty so callers can omit the row
// entirely.
export function whenLabelFor(eventType: string | undefined): string | null {
  if (!eventType) {
    return null;
  }
  return EVENT_TYPE_WHEN_LABEL[eventType] ?? eventType;
}

// Resolve the rule's condition into the "and <verb> <value>" half
// of the When clause. Returns null for `always_true` so callers
// can drop the line entirely.
export function conditionAndLabelFor(
  condition: Record<string, unknown> | undefined,
): string | null {
  const raw = condition?.["type"];
  const t: RuleConditionType =
    raw === "note_content_contains" || raw === "note_title_contains"
      ? raw
      : "always_true";

  if (t === "always_true") {
    return null;
  }
  const substring = readStringField(condition, "substring");
  const verb = t === "note_content_contains" ? "content has" : "title has";
  return substring === "" ? verb : `${verb} "${substring}"`;
}

// Companion field names per condition type.
export const CONDITION_FIELDS: Record<
  RuleConditionType,
  ReadonlyArray<string>
> = {
  always_true: [],
  note_content_contains: ["substring"],
  note_title_contains: ["substring"],
};

// Companion field names per action type.
export const ACTION_CONTEXT_FIELDS: Record<
  RuleActionType,
  ReadonlyArray<string>
> = {
  add_to_directory: ["directory_id"],
  add_tag: ["tag_id"],
};

// Parse a JSON string into a Record, or null on empty / bad input.
export function parseConditionOrContext(
  text: string,
): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Pretty-print a JSON object for the raw view textarea.
export function stringifyRecord(
  value: Record<string, unknown> | undefined,
): string {
  if (!value || Object.keys(value).length === 0) {
    return "{}";
  }
  return JSON.stringify(value, null, 2);
}

// Read a string field from a record with an empty-string fallback.
export function readStringField(
  value: Record<string, unknown> | undefined,
  key: string,
): string {
  if (!value) {
    return "";
  }
  const raw = value[key];
  return typeof raw === "string" ? raw : "";
}
