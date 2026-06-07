import {
  Card,
  CardActions,
  CardContent,
  CardHeader,
  IconButton,
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

export interface AttachmentViewProps {
  attachment: AttachmentMetadata;
}

export const AttachmentView: React.FC<AttachmentViewProps> = ({
  attachment,
}) => {
  const [bigView, setBigView] = useState(false);
  const { setMessage } = useInfoStore();
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
  // Implementation for rendering the attachment view
  return (
    <Card
      sx={{ width: bigView ? "90vw" : "66vw", transition: "300ms ease-in-out" }}
    >
      <CardHeader
        title={attachment.filename}
        action={
          <IconButton onClick={() => setBigView((prev) => !prev)}>
            {bigView ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        }
      />
      <CardContent sx={{ padding: 1 }}>
        <img
          src={url}
          alt={attachment.filename}
          style={{
            width: "auto",
            height: "auto",
            display: "block",
          }}
        />
      </CardContent>
      <CardActions>
        <Tooltip title="Edit filename">
          <IconButton>
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete attachment">
          <IconButton color="error" onClick={handleDelete}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );
};
