import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import GroupsIcon from "@mui/icons-material/Groups";
import LockIcon from "@mui/icons-material/Lock";
import {
  useCreatePermission,
  useDeletePermission,
  usePermissions,
} from "../../api/queries/permissionQueries";
import { useRoles } from "../../api/queries/roleQueries";
import type {
  PermissionRelation,
  PermissionResourceType,
  PermissionSubjectRequest,
} from "../../api/models/search";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { UserSearchPicker } from "../Users/UserSearchPicker";
import { useUsersByIds } from "../../api/queries/userSearchQueries";
import { userAvatarSrc, userInitial } from "../Users/userAvatar";
import {
  advancedColumnsFor,
  basicColumnsFor,
  hasRelation,
  relationshipsForSubject,
  subjectFromRelationship,
  subjectKey,
  type PermissionColumn,
} from "./permissionMatrixModel";

export interface PermissionMatrixProps {
  objectType: PermissionResourceType;
  objectId: string;
  /** Nested inside another dialog already; skips its own card chrome. */
  embedded?: boolean;
}

interface MatrixRow {
  key: string;
  label: string;
  kind: "role" | "user";
  subject: PermissionSubjectRequest;
}

const relationLabelStyle = {
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 600,
  fontSize: "0.68rem",
  whiteSpace: "nowrap",
} as const;

/**
 * Reusable permission editor.
 *
 * Renders a tick matrix of subjects (roles from `/api/roles` plus users
 * already present in the permission set) against the basic relations,
 * with the grant/delegate relations tucked into an accordion.
 */
export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  objectType,
  objectId,
  embedded = false,
}) => {
  const setMessage = useInfoStore((s) => s.setMessage);
  const permissionsQuery = usePermissions({
    object_type: objectType,
    object_id: objectId,
  });
  const rolesQuery = useRoles({});
  const createPermission = useCreatePermission();
  const deletePermission = useDeletePermission();

  const relationships = useMemo(
    () => permissionsQuery.data?.relationships ?? [],
    [permissionsQuery.data],
  );

  const [extraUsers, setExtraUsers] = useState<PermissionSubjectRequest[]>([]);
  const [userIdDraft, setUserIdDraft] = useState("");
  const [busyCell, setBusyCell] = useState<string | null>(null);

  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);

  const roleRows = useMemo<MatrixRow[]>(() => {
    const fromApi: MatrixRow[] = roles.map((role) => ({
      key: `role:${role.id}:member`,
      label: role.name?.trim() || role.id,
      kind: "role" as const,
      subject: {
        object_type: "role" as const,
        object_id: role.id,
        optional_relation: "member" as const,
      },
    }));

    // Include role subjects returned by SpiceDB that are not in the
    // role list (e.g. deleted metadata rows) so they can still be cleared.
    const known = new Set(fromApi.map((row) => row.key));
    for (const relationship of relationships) {
      const subject = subjectFromRelationship(relationship);
      if (subject.object_type !== "role") continue;
      const key = subjectKey(subject);
      if (known.has(key)) continue;
      known.add(key);
      fromApi.push({
        key,
        label: `Role ${subject.object_id}`,
        kind: "role",
        subject,
      });
    }
    return fromApi;
  }, [roles, relationships]);

  const userRows = useMemo<MatrixRow[]>(() => {
    const rows: MatrixRow[] = [];
    const seen = new Set<string>();

    const push = (subject: PermissionSubjectRequest, label?: string) => {
      if (subject.object_type !== "user") return;
      const key = subjectKey(subject);
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({
        key,
        label: label || subject.object_id,
        kind: "user",
        subject,
      });
    };

    for (const relationship of relationships) {
      const subject = subjectFromRelationship(relationship);
      if (subject.object_type === "user") push(subject);
    }
    for (const subject of extraUsers) push(subject);

    return rows;
  }, [relationships, extraUsers]);

  const userIds = useMemo(
    () => userRows.map((row) => row.subject.object_id),
    [userRows],
  );
  const usersQuery = useUsersByIds(userIds);
  const usersById = useMemo(
    () => new Map((usersQuery.data ?? []).map((user) => [user.id, user])),
    [usersQuery.data],
  );
  const resolvedUserRows = useMemo(
    () =>
      userRows.map((row) => ({
        ...row,
        label: usersById.get(row.subject.object_id)?.username || row.label,
      })),
    [userRows, usersById],
  );

  const basicColumns = basicColumnsFor(objectType);
  const advancedColumns = advancedColumnsFor(objectType);

  const addUserRow = () => {
    const id = userIdDraft.trim();
    if (!id) return;
    const subject: PermissionSubjectRequest = {
      object_type: "user",
      object_id: id,
    };
    if (
      extraUsers.some((entry) => subjectKey(entry) === subjectKey(subject)) ||
      userRows.some((row) => row.key === subjectKey(subject))
    ) {
      setMessage(
        new SnackbarUpdateImpl("That user is already listed.", "info"),
      );
      return;
    }
    setExtraUsers((prev) => [...prev, subject]);
    setUserIdDraft("");
  };

  const toggle = async (
    row: MatrixRow,
    column: PermissionColumn,
  ): Promise<void> => {
    if (!objectId || busyCell) return;
    const cellId = `${row.key}:${column.relation}`;
    setBusyCell(cellId);
    try {
      const existing = relationshipsForSubject(relationships, row.subject);
      const matching = existing.find(
        (relationship) => relationship.relation === column.relation,
      );

      if (matching) {
        await deletePermission.mutateAsync({
          object_type: objectType,
          object_id: objectId,
          relationship: {
            relation: column.relation,
            subject: row.subject,
          },
        });
      } else {
        // Basic columns are mutually exclusive per subject: clear the
        // current basic relation before writing the new one.
        if (column.basic) {
          const currentBasic = existing.find((relationship) =>
            basicColumns.some(
              (basic) => basic.relation === relationship.relation,
            ),
          );
          if (currentBasic) {
            await deletePermission.mutateAsync({
              object_type: objectType,
              object_id: objectId,
              relationship: {
                relation: currentBasic.relation as PermissionRelation,
                subject: row.subject,
              },
            });
          }
        }
        await createPermission.mutateAsync({
          object_type: objectType,
          object_id: objectId,
          relationship: {
            relation: column.relation,
            subject: row.subject,
          },
        });
      }
    } catch (error) {
      setMessage(
        new SnackbarUpdateImpl(
          error instanceof Error
            ? error.message
            : "Failed to update permission",
          "error",
        ),
      );
    } finally {
      setBusyCell(null);
    }
  };

  const renderMatrix = (
    columns: readonly PermissionColumn[],
    rows: MatrixRow[],
  ) => (
    <Box
      sx={{
        overflowX: "auto",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <Table size="small" sx={{ minWidth: 420 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ minWidth: 180 }}>
              <Typography variant="caption" color="text.secondary">
                Subject
              </Typography>
            </TableCell>
            {columns.map((column) => (
              <TableCell key={column.relation} align="center">
                <Tooltip title={column.description}>
                  <Typography sx={relationLabelStyle}>
                    {column.label}
                  </Typography>
                </Tooltip>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length + 1}>
                <Typography variant="body2" color="text.secondary">
                  No users or roles to show yet.
                </Typography>
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.key} hover>
              <TableCell>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  {row.kind === "role" ? (
                    <GroupsIcon fontSize="small" color="action" />
                  ) : (
                    <Avatar
                      src={userAvatarSrc(usersById.get(row.subject.object_id))}
                      alt={row.label}
                      sx={{ width: 24, height: 24, fontSize: "0.7rem" }}
                    >
                      {userInitial({
                        id: row.subject.object_id,
                        username: row.label,
                      })}
                    </Avatar>
                  )}
                  <Stack sx={{ minWidth: 0 }}>
                    <Typography variant="body2" noWrap title={row.label}>
                      {row.label}
                    </Typography>
                    {row.kind === "role" && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                      >
                        {row.subject.object_id}
                      </Typography>
                    )}
                  </Stack>
                  {row.kind === "role" && (
                    <Chip
                      size="small"
                      label="Role"
                      variant="outlined"
                      sx={{ ml: "auto" }}
                    />
                  )}
                </Stack>
              </TableCell>
              {columns.map((column) => {
                const checked = hasRelation(
                  relationships,
                  row.subject,
                  column.relation,
                );
                const cellId = `${row.key}:${column.relation}`;
                return (
                  <TableCell
                    key={column.relation}
                    align="center"
                    padding="none"
                  >
                    <Tooltip
                      title={`${checked ? "Remove" : "Grant"} ${column.label} ${
                        checked ? "from" : "to"
                      } ${row.label}`}
                    >
                      <span>
                        <Checkbox
                          size="small"
                          checked={checked}
                          disabled={busyCell !== null}
                          onChange={() => void toggle(row, column)}
                          slotProps={{
                            input: {
                              "aria-label": `${row.label} ${column.label}`,
                            },
                          }}
                        />
                      </span>
                    </Tooltip>
                    {busyCell === cellId && (
                      <CircularProgress
                        size={12}
                        sx={{ display: "block", mx: "auto" }}
                      />
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );

  const content = (
    <Stack spacing={2}>
      {permissionsQuery.isError && (
        <Alert severity="error">
          {permissionsQuery.error instanceof Error
            ? permissionsQuery.error.message
            : "Failed to load permissions"}
        </Alert>
      )}
      {rolesQuery.isError && (
        <Alert severity="warning">
          Roles could not be loaded; role rows may be incomplete.
        </Alert>
      )}

      <Stack spacing={1}>
        <Typography variant="subtitle2">Roles</Typography>
        <Typography variant="body2" color="text.secondary">
          Tick a cell to grant or revoke the permission for every member of that
          role.
        </Typography>
        {permissionsQuery.isLoading || rolesQuery.isLoading ? (
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", py: 2 }}
          >
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Loading permissions…
            </Typography>
          </Stack>
        ) : (
          renderMatrix(basicColumns, roleRows)
        )}
      </Stack>

      <Divider />

      <Stack spacing={1}>
        <Typography variant="subtitle2">Users</Typography>
        <Typography variant="body2" color="text.secondary">
          Users with an explicit permission on this object.
        </Typography>
        {renderMatrix(basicColumns, resolvedUserRows)}

        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <UserSearchPicker
            label="Add user"
            value={userIdDraft}
            onChange={setUserIdDraft}
            helperText="Search by username, id fragment, or exact email."
            sx={{ maxWidth: 420, width: "100%" }}
          />
          <Button
            variant="outlined"
            startIcon={<PersonAddIcon />}
            onClick={addUserRow}
            disabled={!userIdDraft.trim()}
          >
            Add
          </Button>
        </Stack>
      </Stack>

      <Accordion
        disableGutters
        elevation={0}
        sx={{
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          "&:before": { display: "none" },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <LockIcon fontSize="small" color="action" />
            <Typography variant="subtitle2">Advanced permissions</Typography>
            <Typography variant="caption" color="text.secondary">
              grant &amp; delegate relations
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              These relations let a subject pass permissions on to others. They
              are independent of the basic columns above.
            </Typography>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Roles
              </Typography>
              {renderMatrix(advancedColumns, roleRows)}
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Users
              </Typography>
              {renderMatrix(advancedColumns, resolvedUserRows)}
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );

  if (embedded) {
    return content;
  }

  return <Box sx={{ p: 1 }}>{content}</Box>;
};

export default PermissionMatrix;
