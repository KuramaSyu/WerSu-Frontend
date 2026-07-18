import {
  Chip,
  IconButton,
  List,
  ListItem,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

export interface ParentDirectoryPath {
  id: string;
  label: string;
}

export interface PermissionSection {
  label: string;
  users: string[];
}

interface NoteActionPanelProps {
  isLoading: boolean;
  lastEditedLabel: string;
  parentDirectories: ParentDirectoryPath[];
  permissionSections: PermissionSection[];
  onNavigateToDirectory: (id: string) => void;
  onChangeParentClick: () => void;
  canChangeParent: boolean;
  onRemoveParent: (id: string) => void;
  canRemoveParent: boolean;
}

/**
 * Metadata block for the note side panel: last-edited timestamp, parent
 * directory chips (with remove + add), and (commented out) permission
 * sections. Renders nothing visually meaningful while `isLoading` is
 * true.
 */
export const NoteActionPanel: React.FC<NoteActionPanelProps> = ({
  isLoading,
  lastEditedLabel,
  parentDirectories,
  onNavigateToDirectory,
  onChangeParentClick,
  canChangeParent,
  onRemoveParent,
  canRemoveParent,
}) => {
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2" color="textSecondary">
        Metadata
      </Typography>

      {isLoading ? (
        <Typography variant="body2" color="textSecondary">
          Loading metadata...
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          <Stack spacing={0.5}>
            <Typography variant="caption" color="textSecondary">
              Last edited
            </Typography>
            <Typography variant="body2">{lastEditedLabel}</Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="caption" color="textSecondary">
              Parent directories
            </Typography>
            {parentDirectories.length === 0 && (
              <Typography variant="body2" color="textSecondary">
                Root
              </Typography>
            )}
            <List
              dense
              disablePadding
              sx={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 0.5,
                alignItems: "center",
              }}
            >
              {parentDirectories.map((parent) => (
                <ListItem key={parent.id} disablePadding sx={{ width: "auto" }}>
                  <Chip
                    label={parent.label}
                    variant="outlined"
                    onClick={() => onNavigateToDirectory(parent.id)}
                    onDelete={
                      canRemoveParent
                        ? () => onRemoveParent(parent.id)
                        : undefined
                    }
                  />
                </ListItem>
              ))}
              <ListItem disablePadding sx={{ width: "auto" }}>
                <Tooltip title="Add parent directory">
                  <span>
                    <IconButton
                      size="small"
                      onClick={onChangeParentClick}
                      disabled={!canChangeParent}
                      aria-label="add parent directory"
                      sx={{
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 1,
                      }}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </ListItem>
            </List>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
};
