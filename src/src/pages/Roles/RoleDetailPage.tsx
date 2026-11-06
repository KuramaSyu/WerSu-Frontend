import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Avatar,
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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import { M1, M2, M3 } from "../../statics";
import { usePanelSize, useRightPanel } from "../../LayoutProvider";
import TranslucentPaper from "../../components/TranslucentPaper";
import { ConfirmationModal } from "../Settings/ConfirmationModal";
import { PermissionMatrix } from "../../components/Permissions/PermissionMatrix";
import { UserSearchPicker } from "../../components/Users/UserSearchPicker";
import { userAvatarSrc, userInitial } from "../../components/Users/userAvatar";
import { usePermissions } from "../../api/queries/permissionQueries";
import {
  useAddUserToRole,
  useDeleteRole,
  useRemoveUserFromRole,
  useRole,
  useRoleMembers,
  useUpdateRole,
} from "../../api/queries/roleQueries";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { useThemeStore } from "../../zustand/useThemeStore";
import { normalizePermissionObjectType } from "../../components/Permissions/permissionMatrixModel";
import { useUsersByIds } from "../../api/queries/userSearchQueries";
import type { RoleReply } from "../../api/models/role";

const formatDate = (iso?: string): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const RoleDetailPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const roleId = params.id ?? "";
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const setMessage = useInfoStore((s) => s.setMessage);

  const roleQuery = useRole({ id: roleId });
  const membersQuery = useRoleMembers({ role_id: roleId });
  const permissionsQuery = usePermissions({
    object_type: "role",
    object_id: roleId,
  });

  const deleteRole = useDeleteRole();
  const addMember = useAddUserToRole();
  const removeMember = useRemoveUserFromRole();

  const [memberIdDraft, setMemberIdDraft] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  usePanelSize({ left: "clamp(15rem, 20vw, 22rem)" });
  useRightPanel(null);

  const role = roleQuery.data;
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const relationships = useMemo(
    () => permissionsQuery.data?.relationships ?? [],
    [permissionsQuery.data],
  );

  // Resolve every user id shown on this page through the batch endpoint.
  // Unknown ids fall back to the raw id so stale membership edges stay
  // visible (and removable) instead of disappearing.
  const userIds = useMemo(
    () => [
      ...members.map((member) => member.user_id),
      ...relationships
        .filter(
          (relationship) =>
            normalizePermissionObjectType(relationship.subject.object_type) ===
            "user",
        )
        .map((relationship) => relationship.subject.object_id),
    ],
    [members, relationships],
  );
  const usersQuery = useUsersByIds(userIds);
  const usersById = useMemo(
    () => new Map((usersQuery.data ?? []).map((user) => [user.id, user])),
    [usersQuery.data],
  );
  const userLabel = (id: string) => usersById.get(id)?.username || id;

  const addMemberRow = async () => {
    const userId = memberIdDraft.trim();
    if (!role || !userId) return;
    try {
      await addMember.mutateAsync({
        role_id: role.id,
        subject_user_id: userId,
      });
      setMemberIdDraft("");
      setMessage(new SnackbarUpdateImpl("Member added", "success"));
    } catch (error) {
      setMessage(
        new SnackbarUpdateImpl(
          error instanceof Error ? error.message : "Failed to add member",
          "error",
        ),
      );
    }
  };

  const removeMemberRow = async (userId: string) => {
    if (!role) return;
    try {
      await removeMember.mutateAsync({
        role_id: role.id,
        subject_user_id: userId,
      });
      setMessage(new SnackbarUpdateImpl("Member removed", "success"));
    } catch (error) {
      setMessage(
        new SnackbarUpdateImpl(
          error instanceof Error ? error.message : "Failed to remove member",
          "error",
        ),
      );
    }
  };

  const confirmDelete = async () => {
    if (!role) return;
    try {
      await deleteRole.mutateAsync({ id: role.id });
      setMessage(new SnackbarUpdateImpl("Role deleted", "success"));
      setDeleteOpen(false);
      navigate("/roles");
    } catch (error) {
      setMessage(
        new SnackbarUpdateImpl(
          error instanceof Error ? error.message : "Failed to delete role",
          "error",
        ),
      );
    }
  };

  if (!roleId) {
    return <Alert severity="warning">Missing role id.</Alert>;
  }

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
        sx={{
          flex: 1,
          p: M3,
          borderRadius: theme.shape.borderRadius,
          overflowY: "auto",
        }}
      >
        <Stack spacing={M3}>
          <Stack
            direction="row"
            spacing={M2}
            sx={{ alignItems: "center", minWidth: 0 }}
          >
            <Tooltip title="Back to roles">
              <IconButton
                size="small"
                onClick={() => navigate("/roles")}
                aria-label="back to roles"
              >
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <GroupsIcon fontSize="small" color="primary" />
            <Stack sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 600 }} noWrap>
                {role?.name || "Role"}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {roleId}
              </Typography>
            </Stack>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteOpen(true)}
              disabled={!role || deleteRole.isPending}
            >
              Delete
            </Button>
          </Stack>

          {roleQuery.isError && (
            <Alert severity="error">
              {roleQuery.error instanceof Error
                ? roleQuery.error.message
                : "Failed to load role"}
            </Alert>
          )}

          {roleQuery.isLoading && (
            <Stack direction="row" spacing={M1} sx={{ alignItems: "center" }}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                Loading role…
              </Typography>
            </Stack>
          )}

          {role && (
            <>
              <Divider />
              <RoleDetailsForm role={role} />

              <Divider />
              <Stack spacing={M2}>
                <Typography variant="h6">Members</Typography>
                <Typography variant="body2" color="text.secondary">
                  Members inherit every permission granted to this role.
                </Typography>
                {membersQuery.isError && (
                  <Alert severity="warning">
                    {membersQuery.error instanceof Error
                      ? membersQuery.error.message
                      : "Failed to load members"}
                  </Alert>
                )}
                {members.length === 0 && !membersQuery.isLoading ? (
                  <Typography variant="body2" color="text.secondary">
                    No members yet.
                  </Typography>
                ) : (
                  <Stack spacing={M1}>
                    {members.map((member) => (
                      <Stack
                        key={`${member.role_id}:${member.user_id}`}
                        direction="row"
                        spacing={M1}
                        sx={{
                          alignItems: "center",
                          p: 1,
                          border: 1,
                          borderColor: "divider",
                          borderRadius: 2,
                        }}
                      >
                        <Avatar
                          src={userAvatarSrc(usersById.get(member.user_id))}
                          alt={userLabel(member.user_id)}
                          sx={{ width: 26, height: 26, fontSize: "0.75rem" }}
                        >
                          {userInitial({
                            id: member.user_id,
                            username: userLabel(member.user_id),
                          })}
                        </Avatar>
                        <Tooltip title={member.user_id}>
                          <Typography
                            variant="body2"
                            sx={{ flex: 1, minWidth: 0 }}
                            noWrap
                          >
                            {userLabel(member.user_id)}
                          </Typography>
                        </Tooltip>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                        >
                          joined {formatDate(member.granted_at) ?? "unknown"}
                        </Typography>
                        <Tooltip title="Remove member">
                          <span>
                            <IconButton
                              size="small"
                              aria-label={`Remove ${member.user_id}`}
                              onClick={() =>
                                void removeMemberRow(member.user_id)
                              }
                              disabled={removeMember.isPending}
                            >
                              <PersonRemoveIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    ))}
                  </Stack>
                )}
                <Stack
                  direction="row"
                  spacing={M1}
                  sx={{ alignItems: "center" }}
                >
                  <UserSearchPicker
                    label="Add member"
                    value={memberIdDraft}
                    onChange={setMemberIdDraft}
                    helperText="Search by username, id fragment, or exact email."
                    sx={{ maxWidth: 420, width: "100%" }}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<PersonAddIcon />}
                    onClick={() => void addMemberRow()}
                    disabled={!memberIdDraft.trim() || addMember.isPending}
                  >
                    Add
                  </Button>
                </Stack>
              </Stack>

              <Divider />
              <Stack spacing={M2}>
                <Stack
                  direction="row"
                  spacing={M1}
                  sx={{ alignItems: "center" }}
                >
                  <Typography variant="h6">Permissions</Typography>
                  <Typography variant="caption" color="text.secondary">
                    all relationships on this role
                  </Typography>
                </Stack>
                <PermissionMatrix
                  objectType="role"
                  objectId={role.id}
                  embedded
                />

                <Stack spacing={M1} sx={{ pt: M1 }}>
                  <Typography variant="subtitle2">
                    Relationship overview
                  </Typography>
                  {relationships.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No relationships on this role yet.
                    </Typography>
                  ) : (
                    relationships.map((relationship, index) => (
                      <Stack
                        key={`${relationship.relation}:${relationship.subject.object_id}:${index}`}
                        direction="row"
                        spacing={M1}
                        sx={{
                          alignItems: "center",
                          p: 1,
                          border: 1,
                          borderColor: "divider",
                          borderRadius: 2,
                          flexWrap: "wrap",
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {relationship.relation}
                        </Typography>
                        {normalizePermissionObjectType(
                          relationship.subject.object_type,
                        ) === "user" && (
                          <Avatar
                            src={userAvatarSrc(
                              usersById.get(relationship.subject.object_id),
                            )}
                            alt={userLabel(relationship.subject.object_id)}
                            sx={{ width: 22, height: 22, fontSize: "0.7rem" }}
                          >
                            {userInitial({
                              id: relationship.subject.object_id,
                              username: userLabel(
                                relationship.subject.object_id,
                              ),
                            })}
                          </Avatar>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          {normalizePermissionObjectType(
                            relationship.subject.object_type,
                          ) === "user"
                            ? userLabel(relationship.subject.object_id)
                            : `role:${relationship.subject.object_id}`}
                          {relationship.subject.optional_relation
                            ? `#${relationship.subject.optional_relation}`
                            : ""}
                        </Typography>
                      </Stack>
                    ))
                  )}
                </Stack>
              </Stack>
            </>
          )}
        </Stack>
      </TranslucentPaper>

      <ConfirmationModal
        title="Delete this role?"
        message="The role and its membership edges will be removed. Permissions granted to the role stop applying."
        confirmLabel="Delete"
        open={deleteOpen}
        confirming={deleteRole.isPending}
        errorMessage={
          deleteRole.error instanceof Error ? deleteRole.error.message : null
        }
        onCancel={() => {
          if (!deleteRole.isPending) setDeleteOpen(false);
        }}
        onConfirm={() => void confirmDelete()}
        maxWidth="sm"
      />
    </Box>
  );
};

interface RoleDetailsFormProps {
  role: RoleReply;
}

const RoleDetailsForm: React.FC<RoleDetailsFormProps> = ({ role }) => {
  const setMessage = useInfoStore((s) => s.setMessage);
  const updateRole = useUpdateRole();
  const [name, setName] = useState(role.name ?? "");
  const [description, setDescription] = useState(role.description ?? "");
  const dirty =
    name !== (role.name ?? "") || description !== (role.description ?? "");

  const save = async () => {
    if (!name.trim()) return;
    try {
      await updateRole.mutateAsync({
        id: role.id,
        body: {
          name: name.trim(),
          description: description.trim(),
        },
      });
      setMessage(new SnackbarUpdateImpl("Role updated", "success"));
    } catch (error) {
      setMessage(
        new SnackbarUpdateImpl(
          error instanceof Error ? error.message : "Failed to update role",
          "error",
        ),
      );
    }
  };

  return (
    <>
      <Divider />
      <Stack spacing={M2}>
        <Typography variant="h6">Details</Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={M2}>
          <TextField
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            fullWidth
            size="small"
            multiline
            minRows={1}
          />
        </Stack>
        <Stack direction="row" spacing={M2} sx={{ alignItems: "center" }}>
          <Button
            variant="contained"
            onClick={() => void save()}
            disabled={!dirty || updateRole.isPending || !name.trim()}
          >
            Save changes
          </Button>
          <Typography variant="caption" color="text.secondary">
            Created {formatDate(role.created_at) ?? "unknown"}
          </Typography>
        </Stack>
      </Stack>
    </>
  );
};

export default RoleDetailPage;
