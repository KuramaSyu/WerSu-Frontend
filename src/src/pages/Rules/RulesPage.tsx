import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RuleFolderIcon from "@mui/icons-material/RuleFolder";
import type { RuleReply } from "../../api/models/rule";
import {
  useRules,
  useDeleteRule,
  useUpdateRule,
} from "../../api/queries/rulesQueries";
import { useShelf } from "../../api/queries/shelfQueries";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { RuleCard } from "./RuleCard";
import { RuleFormModal } from "./RuleFormModal";
import { ConfirmationModal } from "../Settings/ConfirmationModal";
import { useLeftPanel, usePanelSize } from "../../LayoutProvider";
import { RulesShelfPanel } from "./RulesShelfPanel";

// Rules page scoped to a single shelf.
// Loads GET /api/rules with the shelf filter, renders one card per rule,
// and wires create, edit, delete, and toggle-enable actions.
export const RulesPage: React.FC = () => {
  const params = useParams<{ shelfId: string }>();
  const shelfId = params.shelfId ?? "";
  const navigate = useNavigate();
  const setMessage = useInfoStore((s) => s.setMessage);

  const shelfQuery = useShelf({
    id: shelfId,
    include_books: false,
  });

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

  usePanelSize({ left: "clamp(18rem, 22vw, 26rem)" });
  useLeftPanel(
    <RulesShelfPanel
      shelf={shelfQuery.data ?? null}
      isLoading={shelfQuery.isLoading}
      onBack={() => navigate("/")}
    />,
  );

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

  if (!shelfId) {
    return (
      <Stack
        sx={{ height: "100%", alignItems: "center", justifyContent: "center" }}
        spacing={2}
      >
        <Alert severity="warning">No shelf selected.</Alert>
        <Button variant="outlined" onClick={() => navigate("/")}>
          Go home
        </Button>
      </Stack>
    );
  }

  const rules = rulesQuery.data ?? [];

  return (
    <Paper
      elevation={0}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          py: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", minWidth: 0 }}
        >
          <Tooltip title="Go home">
            <IconButton
              size="small"
              onClick={() => navigate("/")}
              aria-label="go home"
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <RuleFolderIcon fontSize="small" color="primary" />
          <Typography variant="h5" sx={{ fontWeight: 600 }} noWrap>
            Rules
          </Typography>
          <Typography variant="body2" color="text.secondary">
            scoped to {shelfQuery.data?.display_name ?? shelfId}
          </Typography>
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

      {rulesQuery.isLoading ? (
        <Box sx={{ p: 3 }}>
          <LinearProgress />
        </Box>
      ) : null}

      {rulesQuery.isError ? (
        <Alert severity="error" sx={{ m: 2 }}>
          {rulesQuery.error instanceof Error
            ? rulesQuery.error.message
            : "Failed to load rules"}
        </Alert>
      ) : null}

      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          px: 3,
          py: 2,
        }}
      >
        {!rulesQuery.isLoading && rules.length === 0 ? (
          <Stack
            spacing={2}
            sx={{
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              textAlign: "center",
              py: 8,
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
              isToggling={
                togglingId === rule.id || updateRule.isPending
              }
              isDeleting={deletingId === rule.id || deleteRule.isPending}
            />
          ))}
        </Stack>
      </Box>

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
