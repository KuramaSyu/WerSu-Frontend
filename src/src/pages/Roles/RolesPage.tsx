import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import GroupsIcon from "@mui/icons-material/Groups";
import { M1, M2, M3 } from "../../statics";
import { usePanelSize, useRightPanel } from "../../LayoutProvider";
import TranslucentPaper from "../../components/TranslucentPaper";
import Modal from "../../components/Modal";
import { useCreateRole, useRoles } from "../../api/queries/roleQueries";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { useThemeStore } from "../../zustand/useThemeStore";

const formatCreatedAt = (iso?: string): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    date,
  );
};

export const RolesPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const setMessage = useInfoStore((s) => s.setMessage);
  const rolesQuery = useRoles({});
  const createRole = useCreateRole();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  usePanelSize({ left: "clamp(15rem, 20vw, 22rem)" });
  useRightPanel(null);

  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);

  const openCreate = () => {
    setName("");
    setDescription("");
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    try {
      const role = await createRole.mutateAsync({
        name: trimmedName,
        description: description.trim() || undefined,
      });
      setMessage(new SnackbarUpdateImpl("Role created", "success"));
      setCreateOpen(false);
      navigate(`/role/${encodeURIComponent(role.id)}`);
    } catch (error) {
      setMessage(
        new SnackbarUpdateImpl(
          error instanceof Error ? error.message : "Failed to create role",
          "error",
        ),
      );
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "clamp(20rem, 100%, 90rem)",
        alignSelf: "center",
      }}
    >
      <TranslucentPaper
        elevation={0}
        sx={{ flex: 1, p: M3, borderRadius: theme.shape.borderRadius }}
      >
        <Stack spacing={M3}>
          <Stack
            direction="row"
            spacing={M2}
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
            <AdminPanelSettingsIcon fontSize="small" color="primary" />
            <Typography variant="h5" sx={{ fontWeight: 600 }} noWrap>
              Roles
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {rolesQuery.isLoading
                ? "Loading…"
                : `${roles.length} role${roles.length === 1 ? "" : "s"}`}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreate}
            >
              New role
            </Button>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            Roles group users together. Share a note, book or shelf with a role
            to grant access to every member at once.
          </Typography>

          <Divider />

          {rolesQuery.isError && (
            <Alert severity="error">
              {rolesQuery.error instanceof Error
                ? rolesQuery.error.message
                : "Failed to load roles"}
            </Alert>
          )}

          {rolesQuery.isLoading && (
            <Stack
              direction="row"
              spacing={M1}
              sx={{ alignItems: "center", py: 4, justifyContent: "center" }}
            >
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Loading roles…
              </Typography>
            </Stack>
          )}

          {!rolesQuery.isLoading && roles.length === 0 && (
            <Stack
              spacing={M2}
              sx={{ py: 8, textAlign: "center", alignItems: "center" }}
            >
              <GroupsIcon sx={{ fontSize: 48, color: "text.secondary" }} />
              <Typography variant="h6">No roles yet</Typography>
              <Typography variant="body2" color="text.secondary">
                Create a role, add members, then share a resource with it.
              </Typography>
            </Stack>
          )}

          <Stack spacing={M2}>
            {roles.map((role) => {
              const createdAt = formatCreatedAt(role.created_at);
              return (
                <Stack
                  key={role.id}
                  direction="row"
                  spacing={M2}
                  sx={{
                    alignItems: "center",
                    p: 2,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                    cursor: "pointer",
                    "&:hover": { backgroundColor: "action.hover" },
                  }}
                  onClick={() =>
                    navigate(`/role/${encodeURIComponent(role.id)}`)
                  }
                >
                  <GroupsIcon color="action" />
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 600 }}
                      noWrap
                    >
                      {role.name || role.id}
                    </Typography>
                    {role.description && (
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {role.description}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {role.id}
                      {createdAt ? ` · created ${createdAt}` : ""}
                    </Typography>
                  </Stack>
                  <ChevronRightIcon color="action" />
                </Stack>
              );
            })}
          </Stack>
        </Stack>
      </TranslucentPaper>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm">
        <Modal.Header
          icon={<GroupsIcon />}
          title="New role"
          subtitle="Create a named group that can be granted permissions"
        />
        <Modal.Body>
          <Stack spacing={M2}>
            <TextField
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              fullWidth
              size="small"
              required
            />
            <TextField
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              fullWidth
              size="small"
              multiline
              minRows={2}
            />
            <Typography variant="caption" color="text.secondary">
              Creating roles requires super-admin rights on the backend.
            </Typography>
          </Stack>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outlined"
            onClick={() => setCreateOpen(false)}
            disabled={createRole.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void submitCreate()}
            disabled={createRole.isPending || !name.trim()}
          >
            {createRole.isPending ? "Creating…" : "Create role"}
          </Button>
        </Modal.Footer>
      </Modal>
    </Box>
  );
};

export default RolesPage;
