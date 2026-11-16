import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { formatDistanceToNow } from "date-fns";
import {
  NoteVisibilityScope,
  noteVisibilityScopeLabel,
  scopesFromMask,
  type NoteVisibilityScope as VisibilityScope,
} from "../../api/models/noteVisibility";
import {
  useNoteVisibilityStore,
  visibilityScopeLabels,
  type VisibilityRuleMap,
} from "../../zustand/useNoteVisibilityStore";
import { ConfirmationModal } from "./ConfirmationModal";
import { SettingsGroup, SettingsRow } from "./SettingsRow";

interface VisibleRuleRow {
  kind: "note" | "directory";
  id: string;
  scope: number;
  expiresAt?: number;
}

const flattenRules = (
  kind: "note" | "directory",
  record: VisibilityRuleMap,
): VisibleRuleRow[] =>
  Object.entries(record).map(([id, rule]) => ({
    kind,
    id,
    scope: rule.scope,
    ...(rule.expiresAt !== undefined ? { expiresAt: rule.expiresAt } : {}),
  }));

/** Human label for one rule's time window. */
const expiryLabel = (expiresAt?: number): string => {
  if (expiresAt === undefined) {
    return "Until I unhide it";
  }
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return "Invalid expiry";
  }
  return `Expires ${formatDistanceToNow(date, { addSuffix: true })}`;
};

/**
 * Settings category for the current note visibility rules.
 *
 * Rules are created from the right-click Hide submenu on notes, books and
 * search results. This page is the single place to review and remove
 * them, including rules synced from another device once the backend
 * endpoint exists.
 */
export const NoteVisibilitySection: React.FC = () => {
  const notes = useNoteVisibilityStore((state) => state.notes);
  const directories = useNoteVisibilityStore((state) => state.directories);
  const loaded = useNoteVisibilityStore((state) => state.loaded);
  const refresh = useNoteVisibilityStore((state) => state.refresh);
  const unhideTarget = useNoteVisibilityStore((state) => state.unhideTarget);
  const clear = useNoteVisibilityStore((state) => state.clear);

  const [clearOpen, setClearOpen] = useState(false);

  // Pull the backend list once per mount. A missing endpoint is expected
  // today; refresh keeps local rules on failure.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows = useMemo(
    () => [...flattenRules("note", notes), ...flattenRules("directory", directories)],
    [notes, directories],
  );

  const scopeCounts = useMemo(() => {
    const counts = new Map<VisibilityScope, number>();
    for (const row of rows) {
      for (const scope of scopesFromMask(row.scope)) {
        counts.set(scope, (counts.get(scope) ?? 0) + 1);
      }
    }
    return counts;
  }, [rows]);

  return (
    <Stack spacing={2}>
      <SettingsGroup
        title="Hidden recommendations"
        description="Hide notes or whole books from Recent notes, Frequently used and Search without deleting or changing their permissions. Rules can expire on their own or stay until you unhide them."
        action={
          <Button
            size="small"
            variant="outlined"
            startIcon={
              loaded ? <VisibilityIcon /> : <CircularProgress size={16} />
            }
            onClick={() => void refresh()}
            disabled={!loaded && rows.length === 0}
          >
            Reload
          </Button>
        }
      >
        <SettingsRow
          title="Active rules"
          description={
            rows.length === 0
              ? "Right-click a note or book and choose Hide to add a rule. Hidden items appear here."
              : `${rows.length} hidden item${rows.length === 1 ? "" : "s"} across ${scopeCounts.size} surface${scopeCounts.size === 1 ? "" : "s"}.`
          }
          control={
            rows.length > 0 ? (
              <Button
                size="small"
                color="warning"
                variant="outlined"
                onClick={() => setClearOpen(true)}
              >
                Unhide all
              </Button>
            ) : undefined
          }
        />

        {([
          NoteVisibilityScope.RECENT_NOTES,
          NoteVisibilityScope.FREQUENT_NOTES,
          NoteVisibilityScope.SEARCH,
        ] as const).map((scope) => {
          const count = scopeCounts.get(scope) ?? 0;
          return (
            <SettingsRow
              key={scope}
              title={noteVisibilityScopeLabel(scope)}
              description={
                count === 0
                  ? "Nothing hidden on this surface."
                  : `${count} hidden item${count === 1 ? "" : "s"}.`
              }
              control={
                <Chip
                  label={count}
                  size="small"
                  color={count > 0 ? "primary" : "default"}
                  variant={count > 0 ? "filled" : "outlined"}
                />
              }
            />
          );
        })}

        {!loaded && rows.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="info">
              Loading your visibility rules. If the backend endpoint is not
              available yet, rules saved on this device are shown instead.
            </Alert>
          </Box>
        ) : null}

        {rows.length > 0 ? (
          <Stack divider={<Divider flexItem />} sx={{ px: 2, pb: 2 }}>
            {rows.map((row) => (
              <Stack
                key={`${row.kind}:${row.id}`}
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{
                  py: 1.5,
                  alignItems: { xs: "stretch", sm: "center" },
                  justifyContent: "space-between",
                }}
              >
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    <VisibilityOffIcon
                      fontSize="small"
                      sx={{ color: "text.secondary" }}
                    />
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, wordBreak: "break-all" }}
                    >
                      {row.id}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={row.kind === "note" ? "Note" : "Book/Chapter"}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {expiryLabel(row.expiresAt)}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{ flexWrap: "wrap", rowGap: 0.5 }}
                  >
                    {visibilityScopeLabels(row.scope).map((label) => (
                      <Chip key={label} size="small" label={label} />
                    ))}
                  </Stack>
                </Stack>
                <Button
                  size="small"
                  variant="text"
                  startIcon={<VisibilityIcon />}
                  onClick={() =>
                    unhideTarget({ kind: row.kind, id: row.id })
                  }
                  sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
                >
                  Unhide
                </Button>
              </Stack>
            ))}
          </Stack>
        ) : null}
      </SettingsGroup>

      <Alert severity="info">
        Beside each rule, the chips show which surfaces it applies to. Clearing
        a rule does not delete the note; it only makes it eligible to appear in
        those lists again.
      </Alert>

      <ConfirmationModal
        title="Unhide everything?"
        message="Every note and book currently hidden from recommendation lists will be visible again."
        confirmLabel="Unhide all"
        open={clearOpen}
        onCancel={() => setClearOpen(false)}
        onConfirm={() => {
          clear();
          setClearOpen(false);
        }}
      />
    </Stack>
  );
};