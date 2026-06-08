import {
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  CardMedia,
  IconButton,
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

export interface AttachmentViewProps {
  attachment: AttachmentMetadata;
}

export const AttachmentView: React.FC<AttachmentViewProps> = ({
  attachment,
}) => {
  const [bigView, setBigView] = useState(false);
  const { setMessage } = useInfoStore();
  const [filename, setFilename] = useState(attachment.filename);
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
    const api = new AttachmentApi();
    try {
      await api.updateAttachment({
        key: attachment.key,
        filename,
      });
    } catch (error) {
      setMessage(new SnackbarUpdateImpl("Failed to update filename", "error"));
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
          />
        }
        action={
          <IconButton onClick={() => setBigView((prev) => !prev)}>
            {bigView ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
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
