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
} from "@mui/material";
import type { AttachmentMetadata } from "../../api/models/attachment";
import { useState } from "react";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import CloseIcon from "@mui/icons-material/Close";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import { AttachmentApi } from "../../api/AttachmentApi";
import { AttachmentLinkBuilder } from "../../api/utils/AttachmentLInkBuilder";
import { usePatchAttachment } from "../../api/queries/useAttachmentQueries";

enum SavingState {
  Idle,
  Saving,
  Saved,
  Error,
}

export interface AttachmentViewProps {
  attachment: AttachmentMetadata;
  onClose?: () => void;
  // Required to keep the per-key cache fresh on rename.
  noteId?: string;
}

export const AttachmentView: React.FC<AttachmentViewProps> = ({
  attachment,
  onClose,
  noteId,
}) => {
  const [bigView, setBigView] = useState(false);
  const { setMessage } = useInfoStore();
  const [filename, setFilename] = useState(attachment.filename);
  const [savingState, setSavingState] = useState<SavingState>(SavingState.Idle);
  const patchAttachment = usePatchAttachment(noteId ?? "");

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

  // Skip when nothing changed — the saved/saving icon only shows when we actually mutated.
  async function handleFilenameUpdate() {
    if (filename === attachment.filename) return;
    setSavingState(SavingState.Saving);
    try {
      await patchAttachment.mutateAsync({
        patch: { key: attachment.key, filename },
      });
      setSavingState(SavingState.Saved);
      setTimeout(() => setSavingState(SavingState.Idle), 2000);
    } catch (error) {
      setMessage(new SnackbarUpdateImpl("Failed to update filename", "error"));
      setSavingState(SavingState.Idle);
    }
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
            size="small"
            sx={{ width: `50%` }}
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
            <IconButton onClick={onClose}>
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
