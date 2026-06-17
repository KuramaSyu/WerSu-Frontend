import { Button, Chip, Stack, Typography } from "@mui/material";

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
}

export const NoteActionPanel: React.FC<NoteActionPanelProps> = ({
  isLoading,
  lastEditedLabel,
  parentDirectories,
  permissionSections,
  onNavigateToDirectory,
  onChangeParentClick,
  canChangeParent,
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
            {parentDirectories.length === 0 ? (
              <Typography variant="body2">Root</Typography>
            ) : (
              <Stack spacing={0.5}>
                {parentDirectories.map((parent) => (
                  <Chip
                    key={parent.id}
                    label={parent.label}
                    variant="outlined"
                    onClick={() => onNavigateToDirectory(parent.id)}
                  />
                ))}
              </Stack>
            )}
            <Button
              variant="outlined"
              size="small"
              onClick={onChangeParentClick}
              disabled={!canChangeParent}
              sx={{ alignSelf: "flex-start" }}
            >
              Change parent directory
            </Button>
          </Stack>

          <Stack spacing={0.5}>
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
          </Stack>
        </Stack>
      )}
    </Stack>
  );
};
