import {
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  CardMedia,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
} from "@mui/material";
import type { AttachmentMetadata } from "../../api/models/attachment";
import { AttachmentApi, AttachmentLinkBuilder } from "../../api/AttachmentApi";
import { useState } from "react";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import CloseIcon from "@mui/icons-material/Close";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import BackupIcon from "@mui/icons-material/Backup";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import { Cloud } from "@mui/icons-material";

enum SavingState {
  Idle,
  Saving,
  Saved,
  Error,
}

export interface AttachmentViewProps {
  attachment: AttachmentMetadata;
  onClose?: () => void;
}

export const AttachmentView: React.FC<AttachmentViewProps> = ({
  attachment,
  onClose,
}) => {
  const [bigView, setBigView] = useState(false);
  const { setMessage } = useInfoStore();
  const [filename, setFilename] = useState(attachment.filename);
  const [savingState, setSavingState] = useState<SavingState>(SavingState.Idle);
  const handleDelete = () => {
    const api = new AttachmentApi();
    api
      .deleteAttachment(attachment.key)
      .then(() =>
        setMessage(new SnackbarUpdateImpl("Attachment deleted", "success")),
      )
      .catch(() =>
        setMessage(
          new SnackbarUpdateImpl("Failed to delete attachment", "error"),
        ),
      );
  };

  const url = new AttachmentLinkBuilder(new AttachmentApi())
    .setWidth(1080)
    .getLink(attachment.key);

  async function handleFilenameUpdate() {
    setSavingState(SavingState.Saving);
    const api = new AttachmentApi();
    try {
      await api.updateAttachment({
        key: attachment.key,
        filename,
      });
    } catch (error) {
      setMessage(new SnackbarUpdateImpl("Failed to update filename", "error"));
      return;
    }
    setSavingState(SavingState.Saved);
    setTimeout(() => setSavingState(SavingState.Idle), 2000);
  }

  // Implementation for rendering the attachment view
  return (
    <Card
      sx={{
        width: bigView ? "95vw" : "66vw",
        maxHeight: "95vh",
        transition: "300ms ease-in-out",
      }}
    >
      <CardHeader
        title={
          <TextField
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            variant="standard"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <EditIcon />
                  </InputAdornment>
                ),
                endAdornment:
                  savingState === SavingState.Saving ? (
                    <InputAdornment position="end">
                      <CloudUploadIcon />
                    </InputAdornment>
                  ) : savingState === SavingState.Saved ? (
                    <InputAdornment position="end">
                      <CloudDoneIcon color="success" />
                    </InputAdornment>
                  ) : undefined,
              },
            }}
          />
        }
        action={
          <>
            <IconButton onClick={() => setBigView((prev) => !prev)}>
              {bigView ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
            <IconButton onClick={onClose} sx={{ marginLeft: "auto" }}>
              <CloseIcon />
            </IconButton>
          </>
        }
        onBlur={handleFilenameUpdate}
      />
      <CardContent sx={{ padding: 1, overflow: "visible" }}></CardContent>
      <CardMedia
        component={"img"}
        image={url}
        alt={attachment.filename}
        sx={{
          maxWidth: "100%",
          maxHeight: "calc(95vh - 140px)", // leave room for header/actions
          // width: "auto",
          // height: "auto",
          objectFit: "contain",
          margin: "0 auto",
        }}
      />
      <CardActions>
        <Button color="error" onClick={handleDelete} startIcon={<DeleteIcon />}>
          Delete Attachment
        </Button>
      </CardActions>
    </Card>
  );
};
