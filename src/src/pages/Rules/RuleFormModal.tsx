import { useEffect, useMemo, useState } from "react";
import { Button, Tooltip } from "@mui/material";
import RuleFolderIcon from "@mui/icons-material/RuleFolder";
import { ModalShell } from "../../components/ModalShell";
import type {
  AttachedEntityType,
  CreateRuleBody,
  RuleActionType,
  RuleConditionType,
  RuleReply,
  UpdateRuleBody,
} from "../../api/models/rule";
import { RuleFormFields, type RuleFormState } from "./RuleFormFields";
import { useCreateRule, useUpdateRule } from "../../api/queries/rulesQueries";
import { normalizeEventType } from "./ruleFormShared";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";

export interface RuleFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Scope anchor for new rules. Required when mode is create.
  shelfId: string;
  // When set, the modal preloads the rule for editing.
  editingRule?: RuleReply;
  attachedEntityType: AttachedEntityType;
}

type Mode = "create" | "edit";

const defaultForm = (): RuleFormState => ({
  event_type: "NoteCreated",
  attached_entity_type: "shelf",
  attached_entity_id: "",
  condition: { type: "always_true" },
  action_type: "add_to_directory",
  action_context: {},
  enabled: true,
});

const buildEditInitialState = (
  rule: RuleReply,
  attachedEntityType: AttachedEntityType,
): RuleFormState => {
  const conditionType = readConditionType(rule.condition);
  return {
    event_type: normalizeEventType(rule.event_type),
    attached_entity_type:
      (rule.attached_entity_type as AttachedEntityType) ?? attachedEntityType,
    attached_entity_id: rule.attached_entity_id ?? "",
    condition:
      rule.condition && Object.keys(rule.condition).length > 0
        ? rule.condition
        : { type: conditionType },
    action_type: readActionType(rule),
    action_context: rule.action_context ?? {},
    enabled: rule.enabled ?? true,
  };
};

// Pull the condition type back out of a stored payload.
// Falls back to always_true so the form keeps working with new types.
const readConditionType = (
  condition: Record<string, unknown> | undefined,
): RuleConditionType => {
  const t = condition?.["type"];
  if (typeof t === "string") {
    if (
      t === "always_true" ||
      t === "note_content_contains" ||
      t === "note_title_contains"
    ) {
      return t;
    }
  }
  return "always_true";
};

// Pull the action type back out of a stored reply.
const readActionType = (rule: RuleReply): RuleActionType => {
  const t = rule.action_type;
  if (t === "add_to_directory" || t === "add_tag") {
    return t;
  }
  return "add_to_directory";
};

// Single-modal shell for both creating and editing a rule.
// editingRule switches the mode between POST and PATCH /api/rules/:id.
export const RuleFormModal: React.FC<RuleFormModalProps> = ({
  open,
  onOpenChange,
  shelfId,
  editingRule,
  attachedEntityType,
}) => {
  const mode: Mode = editingRule ? "edit" : "create";
  const setMessage = useInfoStore((s) => s.setMessage);

  const createRule = useCreateRule();
  const updateRule = useUpdateRule();

  const [form, setForm] = useState<RuleFormState>(() =>
    mode === "create"
      ? {
          ...defaultForm(),
          attached_entity_id: shelfId,
          attached_entity_type: attachedEntityType,
        }
      : buildEditInitialState(editingRule!, attachedEntityType),
  );

  // Reset the local form whenever the modal opens or its targets change.
  useEffect(() => {
    if (!open) {
      return;
    }
    if (mode === "edit" && editingRule) {
      setForm(buildEditInitialState(editingRule, attachedEntityType));
    } else {
      setForm({
        ...defaultForm(),
        attached_entity_type: attachedEntityType,
        attached_entity_id: shelfId,
      });
    }
  }, [open, mode, editingRule, attachedEntityType, shelfId]);

  const validation = useMemo(() => validateForm(form), [form]);
  const isBusy = createRule.isPending || updateRule.isPending;

  const handleSubmit = async () => {
    if (!validation.ok) {
      setMessage(
        new SnackbarUpdateImpl(validation.error ?? "Invalid rule", "warning"),
      );
      return;
    }

    try {
      if (mode === "edit" && editingRule) {
        const body: UpdateRuleBody = validation.updateBody;
        await updateRule.mutateAsync({ id: editingRule.id, body });
        setMessage(new SnackbarUpdateImpl("Rule updated", "success"));
      } else {
        const body: CreateRuleBody = validation.createBody;
        await createRule.mutateAsync(body);
        setMessage(new SnackbarUpdateImpl("Rule created", "success"));
      }
      onOpenChange(false);
    } catch (error) {
      setMessage(
        new SnackbarUpdateImpl(
          error instanceof Error ? error.message : "Save failed",
          "error",
        ),
      );
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={() => onOpenChange(false)}
      icon={<RuleFolderIcon fontSize="small" />}
      title={mode === "create" ? "New rule" : "Edit rule"}
      subtitle={
        mode === "create"
          ? "Add a new automation attached to this shelf"
          : "Update the rule. Only the fields you change are forwarded."
      }
      maxWidth="md"
      minHeight="40vh"
      actions={
        <>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <Tooltip
            title={validation.ok ? "" : (validation.error ?? "Invalid")}
            disableHoverListener={validation.ok}
          >
            <span>
              <Button
                variant="contained"
                color="primary"
                onClick={() => void handleSubmit()}
                disabled={isBusy || !validation.ok}
              >
                {mode === "create" ? "Create" : "Save"}
              </Button>
            </span>
          </Tooltip>
        </>
      }
    >
      <RuleFormFields initial={form} showRawJsonToggle onChange={setForm} />
    </ModalShell>
  );
};

interface ValidationOk {
  ok: true;
  createBody: CreateRuleBody;
  updateBody: UpdateRuleBody;
}

interface ValidationError {
  ok: false;
  error: string;
}

// Validate the form and, when valid, derive both backend payloads.
function validateForm(form: RuleFormState): ValidationOk | ValidationError {
  if (form.event_type.trim() === "") {
    return { ok: false, error: "Event type is required." };
  }
  if (form.attached_entity_id.trim() === "") {
    return { ok: false, error: "Attached entity id is required." };
  }
  if (!form.condition || Object.keys(form.condition).length === 0) {
    return { ok: false, error: "Condition must not be empty." };
  }
  if (!form.action_context || Object.keys(form.action_context).length === 0) {
    return { ok: false, error: "Action context must not be empty." };
  }

  const createBody: CreateRuleBody = {
    event_type: form.event_type.trim(),
    attached_entity_type: form.attached_entity_type,
    attached_entity_id: form.attached_entity_id.trim(),
    condition: form.condition,
    action_type: form.action_type,
    action_context: form.action_context,
    enabled: form.enabled,
  };

  const updateBody: UpdateRuleBody = createBody;

  return { ok: true, createBody, updateBody };
}
