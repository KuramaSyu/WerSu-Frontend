import {
  Box,
  Chip,
  IconButton,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ShelvesIcon from "@mui/icons-material/Shelves";
import FolderIcon from "@mui/icons-material/Folder";
import LabelIcon from "@mui/icons-material/Label";
import type { RuleReply } from "../../api/models/rule";
import type { RuleActionType } from "../../api/models/rule";
import {
  ACTION_TYPE_LABEL,
  conditionAndLabelFor,
  whenLabelFor,
} from "./ruleFormShared";
import { useShelf } from "../../api/queries/shelfQueries";
import { useDirectory } from "../../api/queries/useDirectoryQuery";
import { useTagStore } from "../../zustand/useTagStore";

export interface RuleCardProps {
  rule: RuleReply;
  onEdit: (rule: RuleReply) => void;
  onDelete: (rule: RuleReply) => void;
  onToggleEnabled: (rule: RuleReply, next: boolean) => void;
  isToggling: boolean;
  isDeleting: boolean;
}

// Single-row summary card for a rule.
// Heavy detail lives behind the edit modal; this card stays glanceable.
export const RuleCard: React.FC<RuleCardProps> = ({
  rule,
  onEdit,
  onDelete,
  onToggleEnabled,
  isToggling,
  isDeleting,
}) => {
  const whenLabel = whenLabelFor(rule.event_type);
  const andLabel = conditionAndLabelFor(rule.condition);
  const actionLine = useActionLine(rule);
  const attachedLabel = useAttachedResourceLabel(rule);

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 2,
        opacity: rule.enabled === false ? 0.7 : 1,
        transition: "opacity 0.15s ease",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "flex-start", justifyContent: "space-between" }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {rule.event_type ?? "(no event_type)"}
            </Typography>
            <Chip
              size="small"
              label={rule.enabled ? "enabled" : "disabled"}
              color={rule.enabled ? "success" : "warning"}
              variant="outlined"
            />
          </Stack>

          <RuleSummaryRow
            label="When"
            content={
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ alignItems: "center", flexWrap: "wrap" }}
              >
                <Chip
                  size="small"
                  variant="outlined"
                  color="primary"
                  label={whenLabel ?? "(no event)"}
                />
                <Typography variant="body2" color="text.secondary">
                  in
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  color="primary"
                  icon={attachedIconNode(rule)}
                  label={attachedLabel}
                />
                {andLabel !== null && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`and ${andLabel}`}
                  />
                )}
              </Stack>
            }
          />

          <RuleSummaryRow
            label="Then"
            content={
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ alignItems: "center", flexWrap: "wrap" }}
              >
                <Chip
                  size="small"
                  variant="outlined"
                  label="add it to"
                />
                {actionLine.detail !== null ? (
                  <Chip
                    size="small"
                    variant="outlined"
                    color="primary"
                    icon={actionLine.iconNode}
                    label={actionLine.detail}
                  />
                ) : (
                  <Chip
                    size="small"
                    variant="outlined"
                    icon={actionLine.iconNode}
                    label={actionLine.verb}
                  />
                )}
              </Stack>
            }
          />
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", flexShrink: 0 }}
        >
          <Tooltip title={rule.enabled ? "Disable rule" : "Enable rule"}>
            <span>
              <Switch
                size="small"
                checked={rule.enabled ?? false}
                onChange={(_, checked) => onToggleEnabled(rule, checked)}
                disabled={isToggling}
                inputProps={{ "aria-label": "toggle rule enabled" }}
              />
            </span>
          </Tooltip>
          <Tooltip title="Edit rule">
            <IconButton
              size="small"
              onClick={() => onEdit(rule)}
              aria-label="edit rule"
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete rule">
            <span>
              <IconButton
                size="small"
                color="error"
                onClick={() => onDelete(rule)}
                aria-label="delete rule"
                disabled={isDeleting}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
};

// Structured action line: verb prefix + icon + a target chip label.
// `detail` is null when the rule has no context id; otherwise it
// is the resolved display name (or raw id if the target hasn't
// loaded yet) for the chip. The verb is the human sentence, used
// as the chip fallback when no detail is available. The icon is
// picked from the action kind and rendered inside the target
// chip so users see what kind of target the rule fires on
// without scanning the sentence.
interface ActionLine {
  verb: string;
  detail: string | null;
  iconNode: React.ReactNode;
}

function actionIconFor(rule: RuleReply): React.ReactNode {
  const context = rule.action_context ?? {};
  const hasShelfId = readStringField(context, "shelf_id") !== "";
  if (rule.action_type === "add_tag") {
    return <LabelIcon fontSize="small" />;
  }
  if (hasShelfId) {
    return <ShelvesIcon fontSize="small" />;
  }
  return <FolderIcon fontSize="small" />;
}

function readActionLineParts(rule: RuleReply): ActionLine {
  const t: RuleActionType =
    rule.action_type === "add_tag" ? "add_tag" : "add_to_directory";
  const label = ACTION_TYPE_LABEL[t] ?? t;
  const verb = label.replace(/\.$/, "");
  const context = rule.action_context ?? {};
  const rawId =
    readStringField(context, "directory_id") ||
    readStringField(context, "tag_id") ||
    readStringField(context, "directoryId");
  return {
    verb,
    detail: rawId === "" ? null : rawId,
    iconNode: actionIconFor(rule),
  };
}

// Resolves the action target (directory / tag) into a display
// label. Returns null when the target isn't loaded yet so callers
// can fall back to the raw id without flicker. Both lookups run
// unconditionally so React's hook order stays stable.
function useActionTargetLabel(rule: RuleReply): string | null {
  const context = rule.action_context ?? {};
  const directoryId =
    readStringField(context, "directory_id") ||
    readStringField(context, "directoryId");
  const tagId = readStringField(context, "tag_id");

  const directoryQuery = useDirectory(directoryId === "" ? undefined : directoryId);
  const tag = useTagStore((s) =>
    tagId === "" ? undefined : s.tagsById[tagId],
  );

  if (directoryId !== "") {
    const directory = directoryQuery.data;
    return directory
      ? (directory.display_name ??
          directory.name ??
          directory.slug ??
          directory.id)
      : null;
  }
  if (tagId !== "") {
    return tag ? (tag.display_name ?? tag.slug ?? tag.id) : null;
  }
  return null;
}

// Composes verb + resolved detail for the action line.
function useActionLine(rule: RuleReply): ActionLine {
  const parts = readActionLineParts(rule);
  const resolvedDetail = useActionTargetLabel(rule);
  if (parts.detail === null) {
    return parts;
  }
  return {
    verb: parts.verb,
    detail: resolvedDetail ?? parts.detail,
    iconNode: parts.iconNode,
  };
}

// Renders one "Prefix: <content>" row so the When / Then lines
// share the same visual rhythm. The label gets a fixed width so
// the content starts at the same x-offset on every rule card.
const RuleSummaryRow: React.FC<{
  label: string;
  content: React.ReactNode;
}> = ({ label, content }) => (
  <Stack
    direction="row"
    spacing={1}
    sx={{ alignItems: "center", flexWrap: "wrap" }}
  >
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ minWidth: "3.25rem" }}
    >
      {label}:
    </Typography>
    {content}
  </Stack>
);

// Pick the icon that matches the attached resource kind so the
// "in <chip>" line reads visually like the action target chip.
function attachedIconNode(rule: RuleReply): React.ReactNode {
  switch (rule.attached_entity_type) {
    case "shelf":
      return <ShelvesIcon fontSize="small" />;
    case "directory":
      return <FolderIcon fontSize="small" />;
    case "note":
      return <LabelIcon fontSize="small" />;
    default:
      return <FolderIcon fontSize="small" />;
  }
}

// Render the attached resource as "<type> <display name>" instead
// of "shelf#<uuid>". Falls back to the raw id while the resource
// is still loading or has no display label.
function useAttachedResourceLabel(rule: RuleReply): string {
  const type = rule.attached_entity_type ?? "?";
  const id = rule.attached_entity_id ?? "";

  if (id === "") {
    return type;
  }

  const shelfQuery = useShelf(
    type === "shelf" ? { id, include_books: false } : { id: "", include_books: false },
  );
  const directoryQuery = useDirectory(
    type === "directory" ? id : undefined,
  );

  if (type === "shelf") {
    const shelf = shelfQuery.data;
    return `${shelf ? (shelf.display_name ?? shelf.slug ?? shelf.id) : id}`;
  }
  if (type === "directory") {
    const directory = directoryQuery.data;
    return `${directory ? (directory.display_name ?? directory.name ?? directory.id) : id}`;
  }
  return id;
}

// Read a string field from a record with an empty-string fallback.
function readStringField(
  value: Record<string, unknown> | undefined,
  key: string,
): string {
  if (!value) {
    return "";
  }
  const raw = value[key];
  return typeof raw === "string" ? raw : "";
}
