import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RuleFolderIcon from "@mui/icons-material/RuleFolder";
import type { RuleReply } from "../../api/models/rule";
import {
  useRules,
  useDeleteRule,
  useUpdateRule,
} from "../../api/queries/rulesQueries";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { RuleCard } from "./RuleCard";
import { RuleFormModal } from "./RuleFormModal";
import { ConfirmationModal } from "../Settings/ConfirmationModal";

export interface ShelfRulesManagerProps {
  /** Shelf whose rules are listed and edited. */
  shelfId: string;
}

/**
 * Rules manager scoped to a single shelf.
 *
 * Loads `GET /api/rules` with the shelf filter, renders one card per
 * rule, and wires create, edit, delete, and toggle-enable actions.
 * Renderable both as a standalone page body and inside the shelf
 * settings tabs; it owns no routing or side-panel state.
 */
export const ShelfRulesManager: React.FC<ShelfRulesManagerProps> = ({
  shelfId,
}) => {
  const setMessage = useInfoStore((s) => s.setMessage);

  const listRequest = useMemo(
    () =>
      ({
        attached_entity_type: "shelf",
        attached_entity_id: shelfId,
      }) as const,
    [shelfId],
  );

  const rulesQuery = useRules(listRequest);

  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleReply | undefined>(
    undefined,
  );
  const [pendingDelete, setPendingDelete] = useState<RuleReply | undefined>(
    undefined,
  );
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const onCreate = () => {
    setEditingRule(undefined);
    setFormModalOpen(true);
  };

  const onEdit = (rule: RuleReply) => {
    setEditingRule(rule);
    setFormModalOpen(true);
  };

  const onDelete = (rule: RuleReply) => {
    setPendingDelete(rule);
  };

  const onToggleEnabled = async (rule: RuleReply, next: boolean) => {
    setTogglingId(rule.id);
    try {
      await updateRule.mutateAsync({
        id: rule.id,
        body: { enabled: next },
      });
      setMessage(
        new SnackbarUpdateImpl(
          next ? "Rule enabled" : "Rule disabled",
          "success",
        ),
      );
    } catch (error) {
      setMessage(
        new SnackbarUpdateImpl(
          error instanceof Error ? error.message : "Toggle failed",
          "error",
        ),
      );
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    setDeletingId(pendingDelete.id);
    try {
      await deleteRule.mutateAsync({ id: pendingDelete.id });
      setMessage(new SnackbarUpdateImpl("Rule deleted", "success"));
      setPendingDelete(undefined);
    } catch (error) {
      setMessage(
        new SnackbarUpdateImpl(
          error instanceof Error ? error.message : "Delete failed",
          "error",
        ),
      );
    } finally {
      setDeletingId(null);
    }
  };

  const rules = rulesQuery.data ?? [];

  return (
    <Paper
      component="section"
      variant="outlined"
      elevation={0}
      sx={{ p: 3, borderRadius: 2, borderColor: "divider" }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={2}
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", minWidth: 0 }}
          >
            <RuleFolderIcon fontSize="small" color="primary" />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6">Automation rules</Typography>
              <Typography variant="body2" color="text.secondary">
                Rules fire on note events scoped to this shelf.
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onCreate}
            disabled={rulesQuery.isLoading}
          >
            New rule
          </Button>
        </Stack>

        {rulesQuery.isLoading ? <LinearProgress /> : null}

        {rulesQuery.isError ? (
          <Alert severity="error">
            {rulesQuery.error instanceof Error
              ? rulesQuery.error.message
              : "Failed to load rules"}
          </Alert>
        ) : null}

        {!rulesQuery.isLoading && rules.length === 0 ? (
          <Stack
            spacing={2}
            sx={{
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              py: 6,
            }}
          >
            <RuleFolderIcon
              sx={{ fontSize: 48, color: "text.secondary", opacity: 0.6 }}
            />
            <Typography variant="h6">No rules yet</Typography>
            <Typography variant="body2" color="text.secondary">
              Add a rule to fire on note events for this shelf.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onCreate}
            >
              New rule
            </Button>
          </Stack>
        ) : null}

        <Stack spacing={2}>
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleEnabled={onToggleEnabled}
              isToggling={togglingId === rule.id || updateRule.isPending}
              isDeleting={deletingId === rule.id || deleteRule.isPending}
            />
          ))}
        </Stack>
      </Stack>

      <RuleFormModal
        open={formModalOpen}
        onOpenChange={(open) => {
          setFormModalOpen(open);
          if (!open) {
            setEditingRule(undefined);
          }
        }}
        shelfId={shelfId}
        attachedEntityType="shelf"
        editingRule={editingRule}
      />

      <ConfirmationModal
        open={pendingDelete !== undefined}
        onCancel={() => setPendingDelete(undefined)}
        onConfirm={() => void confirmDelete()}
        title="Delete rule?"
        message={
          pendingDelete ? (
            <Box>
              <Typography>
                Permanently delete rule{" "}
                <strong>{pendingDelete.event_type}</strong> (
                {pendingDelete.id})?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Future events will no longer fire this automation. The
                attached resource (this shelf) is untouched.
              </Typography>
            </Box>
          ) : null
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirming={deletingId !== null}
        maxWidth="sm"
      />

      {updateRule.isPending ? (
        <Box
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <CircularProgress size={20} />
        </Box>
      ) : null}
    </Paper>
  );
};

export default ShelfRulesManager;
