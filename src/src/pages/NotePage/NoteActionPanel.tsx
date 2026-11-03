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

interface ParentDirectoryPath {
  id: string;
  label: string;
}

interface PermissionSection {
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

export const NoteActionPanel: React.FC<NoteActionPanelProps> = ({
  isLoading,
  lastEditedLabel,
  parentDirectories,
  permissionSections,
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
              Parent books or chapters
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
                <Tooltip title="Add parent book or chapter">
                  <span>
                    <IconButton
                      size="small"
                      onClick={onChangeParentClick}
                      disabled={!canChangeParent}
                      aria-label="add parent book or chapter"
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

          {/* <Stack spacing={0.5}>
            <Typography variant="caption" color="textSecondary">
              Permissions
            </Typography>
            {permissionSections.length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                No explicit user permissions.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {permissionSections.map((section) => (
                  <Stack key={section.label} spacing={0.5}>
                    <Typography variant="body2">{section.label}</Typography>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{ flexWrap: "wrap" }}
                    >
                      {section.users.map((user) => (
                        <Chip
                          key={`${section.label}-${user}`}
                          label={user}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            )}
          </Stack> */}
        </Stack>
      )}
    </Stack>
  );
};
