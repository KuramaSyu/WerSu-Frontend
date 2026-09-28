import { useMemo, useState } from "react";
import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import ShelvesIcon from "@mui/icons-material/Shelves";
import FolderIcon from "@mui/icons-material/Folder";
import LabelIcon from "@mui/icons-material/Label";
import type {
  AttachedEntityType,
  RuleActionType,
  RuleConditionType,
} from "../../api/models/rule";
import {
  ACTION_CONTEXT_FIELDS,
  ACTION_TYPE_LABEL,
  ACTION_TYPE_OPTIONS,
  CONDITION_FIELDS,
  CONDITION_TYPE_LABEL,
  CONDITION_TYPE_OPTIONS,
  EVENT_TYPE_WHEN_LABEL,
  conditionAndLabelFor,
  parseConditionOrContext,
  readStringField,
  stringifyRecord,
  whenLabelFor,
} from "./ruleFormShared";
import {
  RuleEntityPicker,
  useEntityDisplayLabel,
  type RuleEntityKind,
} from "./RuleEntityPicker";

// Map from action context field name to a friendly picker kind so
// `directory_id` becomes a directory picker and `tag_id` becomes a
// tag picker. Unknown field names fall back to a free-text input.
const ACTION_CONTEXT_PICKER_KIND: Record<string, RuleEntityKind | undefined> = {
  directory_id: "directory",
  tag_id: "tag",
  shelf_id: "shelf",
};

// Map from attached entity type to picker kind.
const ENTITY_TYPE_TO_PICKER_KIND: Record<AttachedEntityType, RuleEntityKind> = {
  shelf: "shelf",
  directory: "directory",
  note: "note",
};

// Icon for the attached-scope chip in the live preview.
function scopeIconFor(type: AttachedEntityType): React.ReactElement {
  switch (type) {
    case "shelf":
      return <ShelvesIcon fontSize="small" />;
    case "directory":
      return <FolderIcon fontSize="small" />;
    case "note":
      return <LabelIcon fontSize="small" />;
  }
}

// Icon for the action-target chip in the live preview.
function targetIconFor(context: Record<string, unknown>): React.ReactElement {
  if (readStringField(context, "shelf_id") !== "") {
    return <ShelvesIcon fontSize="small" />;
  }
  if (readStringField(context, "tag_id") !== "") {
    return <LabelIcon fontSize="small" />;
  }
  return <FolderIcon fontSize="small" />;
}

export interface RuleFormState {
  event_type: string;
  attached_entity_type: AttachedEntityType;
  attached_entity_id: string;
  condition: Record<string, unknown>;
  action_type: RuleActionType;
  action_context: Record<string, unknown>;
  enabled: boolean;
}

export interface RuleFormFieldsProps {
  initial: RuleFormState;
  showRawJsonToggle?: boolean;
  rawJson?: boolean;
  onChange: (state: RuleFormState) => void;
}

// Structured plus raw-JSON form for a single rule.
// Set rawJson to collapse the structured inputs into one textarea per object.
export const RuleFormFields: React.FC<RuleFormFieldsProps> = ({
  initial,
  showRawJsonToggle = false,
  rawJson: controlledRawJson,
  onChange,
}) => {
  const [localRaw, setLocalRaw] = useState(false);
  const rawJson = controlledRawJson ?? localRaw;
  const rawJsonUncontrolled = controlledRawJson === undefined;

  const conditionType = useMemo<RuleConditionType>(() => {
    const t = readStringField(initial.condition, "type");
    if (CONDITION_TYPE_OPTIONS.includes(t as RuleConditionType)) {
      return t as RuleConditionType;
    }
    return "always_true";
  }, [initial.condition]);

  const setConditionField = (key: string, value: string) => {
    const next: Record<string, unknown> = { ...initial.condition };
    if (value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange({ ...initial, condition: next });
  };

  const setConditionType = (next: RuleConditionType) => {
    const allowedKeys = new Set(CONDITION_FIELDS[next]);
    const filtered: Record<string, unknown> = { type: next };
    if (initial.condition) {
      for (const [k, v] of Object.entries(initial.condition)) {
        if (k !== "type" && allowedKeys.has(k)) {
          filtered[k] = v;
        }
      }
    }
    onChange({ ...initial, condition: filtered });
  };

  const setActionContextField = (key: string, value: string) => {
    const next: Record<string, unknown> = { ...initial.action_context };
    if (value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange({ ...initial, action_context: next });
  };

  const conditionFields = CONDITION_FIELDS[conditionType];
  const actionFields = ACTION_CONTEXT_FIELDS[initial.action_type];

  return (
    <Stack spacing={2}>
      <RulePreview initial={initial} />

      <Section
        label="When"
        right={
          showRawJsonToggle ? (
            <RawJsonToggle
              checked={rawJson}
              onChange={(checked) => {
                if (rawJsonUncontrolled) {
                  setLocalRaw(checked);
                }
              }}
            />
          ) : null
        }
      >
        <Stack spacing={2}>
          <FormControl size="small" fullWidth>
            <InputLabel id="rule-event-type-label">Event type</InputLabel>
            <Select
              labelId="rule-event-type-label"
              label="Event type"
              value={
                Object.prototype.hasOwnProperty.call(
                  EVENT_TYPE_WHEN_LABEL,
                  initial.event_type,
                )
                  ? initial.event_type
                  : "__custom__"
              }
              onChange={(e) => {
                const next = e.target.value;
                if (next === "__custom__") {
                  return;
                }
                onChange({ ...initial, event_type: next });
              }}
            >
              {Object.entries(EVENT_TYPE_WHEN_LABEL).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">
              fires for
            </Typography>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={initial.attached_entity_type}
                onChange={(e) =>
                  onChange({
                    ...initial,
                    attached_entity_type: e.target.value as AttachedEntityType,
                    attached_entity_id: "",
                  })
                }
                size="small"
                inputProps={{ "aria-label": "attached entity type" }}
              >
                <MenuItem value="shelf">shelf</MenuItem>
                <MenuItem value="directory">directory</MenuItem>
                <MenuItem value="note">note</MenuItem>
              </Select>
            </FormControl>
            <RuleEntityPicker
              kind={ENTITY_TYPE_TO_PICKER_KIND[initial.attached_entity_type]}
              value={initial.attached_entity_id}
              onChange={(id) =>
                onChange({ ...initial, attached_entity_id: id })
              }
              label={`Pick ${initial.attached_entity_type}`}
              error={initial.attached_entity_id.trim() === ""}
              size="small"
            />
          </Stack>
        </Stack>
      </Section>

      <Section label="If">
        {rawJson ? (
          <RawConditionField
            value={initial.condition}
            onChange={(next) => onChange({ ...initial, condition: next })}
          />
        ) : (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Chip size="small" variant="outlined" label="condition" />
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <Select
                  value={conditionType}
                  onChange={(e) =>
                    setConditionType(e.target.value as RuleConditionType)
                  }
                  size="small"
                  inputProps={{ "aria-label": "condition type" }}
                >
                  {CONDITION_TYPE_OPTIONS.map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {CONDITION_TYPE_LABEL[opt]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            {conditionType !== "always_true" && (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  matches
                </Typography>
                {conditionFields.map((field) => (
                  <TextField
                    key={field}
                    label={field}
                    size="small"
                    value={readStringField(initial.condition, field)}
                    onChange={(e) => setConditionField(field, e.target.value)}
                    slotProps={{ htmlInput: { spellCheck: "false" } }}
                    sx={{ flexGrow: 1, minWidth: 200 }}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </Section>

      <Section label="Then">
        {rawJson ? (
          <RawJsonField
            label="Action context JSON"
            value={initial.action_context}
            onChange={(next) => onChange({ ...initial, action_context: next })}
          />
        ) : (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <Select
                  value={initial.action_type}
                  onChange={(e) => {
                    const next = e.target.value as RuleActionType;
                    const allowedKeys = new Set(ACTION_CONTEXT_FIELDS[next]);
                    const filtered: Record<string, unknown> = {};
                    for (const [k, v] of Object.entries(
                      initial.action_context ?? {},
                    )) {
                      if (allowedKeys.has(k)) {
                        filtered[k] = v;
                      }
                    }
                    onChange({
                      ...initial,
                      action_type: next,
                      action_context: filtered,
                    });
                  }}
                  size="small"
                  inputProps={{ "aria-label": "action type" }}
                >
                  {ACTION_TYPE_OPTIONS.map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {ACTION_TYPE_LABEL[opt]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary">
                targeting
              </Typography>
              {actionFields.map((field) => {
                const pickerKind = ACTION_CONTEXT_PICKER_KIND[field];
                if (pickerKind !== undefined) {
                  return (
                    <RuleEntityPicker
                      key={field}
                      kind={pickerKind}
                      value={readStringField(initial.action_context, field)}
                      onChange={(id) => setActionContextField(field, id)}
                      label={contextLabelFor(field)}
                      error={
                        readStringField(initial.action_context, field) === ""
                      }
                      size="small"
                    />
                  );
                }
                return (
                  <TextField
                    key={field}
                    label={field}
                    size="small"
                    value={readStringField(initial.action_context, field)}
                    onChange={(e) =>
                      setActionContextField(field, e.target.value)
                    }
                    slotProps={{ htmlInput: { spellCheck: "false" } }}
                    sx={{ flexGrow: 1, minWidth: 200 }}
                  />
                );
              })}
            </Stack>
          </Stack>
        )}
      </Section>

      <Section label="State">
        <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
          <Switch
            checked={initial.enabled}
            onChange={(_, checked) =>
              onChange({ ...initial, enabled: checked })
            }
            slotProps={{ input: { "aria-label": "rule enabled" } }}
          />
          <Typography variant="body2">
            {initial.enabled
              ? "Rule fires when its condition matches."
              : "Rule is paused."}
          </Typography>
        </Stack>
      </Section>
    </Stack>
  );
};

// Inline preview that mirrors the RuleCard layout so the user can
// see the sentence their inputs build while they edit. Chips with
// missing values render disabled so gaps are obvious.
const RulePreview: React.FC<{
  initial: RuleFormState;
}> = ({ initial }) => {
  const whenLabel = whenLabelFor(initial.event_type);
  const andLabel = conditionAndLabelFor(initial.condition);
  const attachedLabel = useAttachedLabel(initial);
  const { kind: actionKind, id: actionId } = actionTargetFrom(initial);
  const actionLabel = useEntityDisplayLabel(actionKind, actionId);
  const targetKindForChip: RuleEntityKind | null =
    actionId === "" ? null : actionKind;
  const actionTarget = actionLabel ?? actionId;

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 1.5,
        bgcolor: "background.default",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", flexWrap: "wrap" }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ minWidth: "3.25rem" }}
        >
          When
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          color="primary"
          label={whenLabel ?? "no event"}
        />
        <Typography variant="caption" color="text.secondary">
          in
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          color="primary"
          icon={scopeIconFor(initial.attached_entity_type)}
          label={attachedLabel}
        />
        {andLabel !== null && (
          <Chip size="small" variant="outlined" label={`and ${andLabel}`} />
        )}
        <Typography variant="caption" color="text.secondary">
          then
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          color="primary"
          icon={targetIconFor(initial.action_context)}
          label={
            targetKindForChip === null
              ? ACTION_TYPE_LABEL[initial.action_type]
              : actionTarget
          }
        />
      </Stack>
    </Box>
  );
};

// Section wrapper used by the form. Keeps the When / If / Then /
// State rows visually identical (label gutter + bordered card).
const Section: React.FC<{
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, right, children }) => (
  <Box
    sx={{
      border: "1px solid",
      borderColor: "divider",
      borderRadius: 2,
      p: 2,
    }}
  >
    <Stack
      direction="row"
      sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}
    >
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ minWidth: "3.25rem" }}
      >
        {label}
      </Typography>
      {right}
    </Stack>
    {children}
  </Box>
);

const RawJsonToggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ checked, onChange }) => (
  <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
    <Typography variant="caption" color="text.secondary">
      Raw JSON
    </Typography>
    <Switch
      size="small"
      checked={checked}
      onChange={(_, c) => onChange(c)}
      slotProps={{ input: { "aria-label": "toggle raw JSON" } }}
    />
  </Stack>
);

// JSON textarea control for one of the rule payload objects.
const RawJsonField: React.FC<{
  value: Record<string, unknown> | undefined;
  onChange: (next: Record<string, unknown>) => void;
  label: string;
}> = ({ value, onChange, label }) => {
  const [text, setText] = useState(stringifyRecord(value));
  const [error, setError] = useState<string | null>(null);

  return (
    <TextField
      label={label}
      multiline
      minRows={3}
      maxRows={10}
      size="small"
      fullWidth
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        const parsed = parseConditionOrContext(next);
        if (next.trim() === "" || parsed !== null) {
          setError(null);
          onChange(parsed ?? {});
        } else {
          setError("Invalid JSON object");
        }
      }}
      error={error !== null}
      helperText={error ?? undefined}
      slotProps={{ htmlInput: { spellCheck: "false" } }}
      sx={{ mt: 1, fontFamily: "monospace" }}
    />
  );
};

const RawConditionField: React.FC<{
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}> = (props) => <RawJsonField label="Condition JSON" {...props} />;

// Friendly label for a known action-context field.
function contextLabelFor(field: string): string {
  switch (field) {
    case "directory_id":
      return "Target directory";
    case "tag_id":
      return "Target tag";
    case "shelf_id":
      return "Target shelf";
    default:
      return field;
  }
}

// Resolves the action target id together with its picker kind so
// the preview can ask `useEntityDisplayLabel` for the display name.
function actionTargetFrom(form: RuleFormState): {
  kind: RuleEntityKind;
  id: string;
} {
  const context = form.action_context ?? {};
  const shelfId = readStringField(context, "shelf_id");
  if (shelfId !== "") {
    return { kind: "shelf", id: shelfId };
  }
  const tagId = readStringField(context, "tag_id");
  if (tagId !== "") {
    return { kind: "tag", id: tagId };
  }
  const directoryId =
    readStringField(context, "directory_id") ||
    readStringField(context, "directoryId");
  return { kind: "directory", id: directoryId };
}

// Resolves the attached entity id to a display label so the
// preview chip shows the shelf / directory / note / tag name
// instead of its id.
function useAttachedLabel(form: RuleFormState): string {
  const id = form.attached_entity_id;
  const type = form.attached_entity_type;
  const kind: RuleEntityKind = type;
  const label = useEntityDisplayLabel(kind, id);
  if (id === "") {
    return `pick ${type}`;
  }
  return label ?? id;
}
