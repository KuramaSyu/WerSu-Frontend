import { Box, Button, Stack, Typography } from "@mui/material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import CloseIcon from "@mui/icons-material/Close";
import ModalShell from "../ModalShell";
import type { PermissionResourceType } from "../../api/models/search";
import { PermissionMatrix } from "./PermissionMatrix";

export interface PermissionEditorProps {
  open: boolean;
  onClose: () => void;
  objectType: PermissionResourceType;
  objectId: string;
  /** Human-friendly name of the note / directory / role being edited. */
  title?: string;
}

const TYPE_LABEL: Record<PermissionResourceType, string> = {
  note: "note",
  directory: "book or chapter",
  shelf: "shelf",
  role: "role",
};

export const PermissionEditor: React.FC<PermissionEditorProps> = ({
  open,
  onClose,
  objectType,
  objectId,
  title,
}) => {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      icon={<AdminPanelSettingsIcon />}
      title="Permissions"
      subtitle={`${title ? `${title} · ` : ""}${TYPE_LABEL[objectType]}`}
      maxWidth="md"
      minHeight="42vh"
      actions={
        <Button onClick={onClose} variant="contained" startIcon={<CloseIcon />}>
          Close
        </Button>
      }
    >
      <Stack spacing={2}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            border: 1,
            borderColor: "divider",
            backgroundColor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.03)"
                : "rgba(0,0,0,0.02)",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Share this {TYPE_LABEL[objectType]} with users or roles. Basic
            permissions are shown first; grant and delegate relations live under
            Advanced permissions.
          </Typography>
        </Box>
        {open && objectId ? (
          <PermissionMatrix
            objectType={objectType}
            objectId={objectId}
            embedded
          />
        ) : null}
      </Stack>
    </ModalShell>
  );
};

export default PermissionEditor;
