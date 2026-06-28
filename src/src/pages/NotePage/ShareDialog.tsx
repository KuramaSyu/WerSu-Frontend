import {
  Box,
  Button,
  ButtonGroup,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import { useThemeStore } from "../../zustand/useThemeStore";
import { M1, M2, M3, M4, M5 } from "../../statics";
import RotatingStrokeBox from "../../components/RotatingCirle";
import { useState } from "react";
import PublicIcon from "@mui/icons-material/Public";
import InsertLinkIcon from "@mui/icons-material/InsertLink";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import CollapseToggleButton from "../../components/CollapseToggleButton";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { getSharingApi, sharingApi } from "../../api/SharingApi";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";

export interface ShareDialogProps {
  noteId: string;
  open: boolean;
  onClose: () => void;
}

const Hours_1 = 60 * 60;
const Days_1 = Hours_1 * 24;
const Weeks_1 = Days_1 * 7;
const Months_1 = Days_1 * 30;
const Months_3 = Months_1 * 3;
const Years_1 = Days_1 * 365;

export const ShareDialog: React.FC<ShareDialogProps> = ({
  noteId,
  open,
  onClose,
}) => {
  const { theme } = useThemeStore();
  const [shareType, setShareType] = useState("link");
  const [accessType, setAccessType] = useState("read");
  const [activeSeconds, setActiveSeconds] = useState(Months_1);
  const [description, setDescription] = useState<string | null>(null);
  const setMessage = useInfoStore((s) => s.setMessage);

  const scheduleItems = [
    { children: "1H", value: Hours_1, whenSelected: "1 Hour" },
    { children: "1D", value: Days_1, whenSelected: "1 Day" },
    { children: "1W", value: Weeks_1, whenSelected: "1 Week" },
    { children: "1M", value: Months_1, whenSelected: "1 Month" },
    { children: "3M", value: Months_3, whenSelected: "3 Months" },
    { children: "1Y", value: Years_1, whenSelected: "1 Year" },
  ];

  const handleChangeShare = (
    event: React.MouseEvent<HTMLElement>,
    newAlignment: string,
  ) => {
    setShareType(newAlignment);
  };
  const shareControl = {
    value: shareType,
    onChange: handleChangeShare,
    exclusive: true,
  };

  const handleChangeAccess = (
    event: React.MouseEvent<HTMLElement>,
    newAlignment: string,
  ) => {
    setAccessType(newAlignment);
  };
  const accessControl = {
    value: accessType,
    onChange: handleChangeAccess,
    exclusive: true,
  };

  const handleChangeSchedule = (
    event: React.MouseEvent<HTMLElement>,
    newAlignment: number,
  ) => {
    setActiveSeconds(newAlignment);
  };

  const scheduleControl = {
    value: activeSeconds,
    onChange: handleChangeSchedule,
    exclusive: true,
  };

  const onShare = () => {
    getSharingApi()
      .createShare({
        share: {
          note_id: noteId,
          description: description ?? undefined,
          online_until: new Date(
            Date.now() + activeSeconds * 1000,
          ).toISOString(),
          online_since: new Date().toISOString(),
          permission:
            accessType === "write"
              ? "SHARE_PERMISSION_WRITE"
              : "SHARE_PERMISSION_READ",
        },
      })
      .then((reply) => {
        setMessage(
          new SnackbarUpdateImpl(`Share created with ID: ${reply.id}`),
        );
      })
      .catch((error) => {
        setMessage(
          new SnackbarUpdateImpl(
            `Error creating share: ${error.message}`,
            "error",
          ),
        );
      });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      sx={{ overflow: "hidden", p: 0, m: 0 }}
    >
      <DialogContent sx={{ overflow: "hidden" }}>
        {/* group with share icon and content */}
        <Stack direction={"row"} spacing={M4} sx={{}}>
          <RotatingStrokeBox
            color={theme.palette.primary.main}
            borderRadius={100}
          >
            <ShareIcon sx={{ fontSize: theme.typography.h3.fontSize }} />
          </RotatingStrokeBox>
          <Divider orientation="vertical" flexItem />

          {/* group with sharing options and schedule */}
          <Stack direction="column" spacing={M3}>
            <Stack
              className="dialog-sharing-options"
              direction={"column"}
              spacing={M1}
            >
              <Typography variant="h5">Visibility</Typography>

              <ToggleButtonGroup aria-label="sharing options" {...shareControl}>
                <Tooltip title="Everyone can find and see it">
                  <CollapseToggleButton
                    value="public"
                    sx={{ gap: M2 }}
                    selected={shareType === "public"}
                    whenSelected={
                      <Typography sx={{ whiteSpace: "nowrap", pl: M2 }}>
                        Public
                      </Typography>
                    }
                  >
                    <PublicIcon />
                  </CollapseToggleButton>
                </Tooltip>

                <Tooltip title="Only people with the link can access it">
                  <CollapseToggleButton
                    value="link"
                    sx={{ gap: M2 }}
                    selected={shareType === "link"}
                    whenSelected={
                      <Typography sx={{ whiteSpace: "nowrap", pl: M2 }}>
                        Link
                      </Typography>
                    }
                  >
                    <InsertLinkIcon />
                  </CollapseToggleButton>
                </Tooltip>

                <Tooltip title="Share it with specific users">
                  <CollapseToggleButton
                    value="user"
                    sx={{ gap: M2 }}
                    selected={shareType === "user"}
                    whenSelected={
                      <Typography sx={{ whiteSpace: "nowrap", pl: M2 }}>
                        User
                      </Typography>
                    }
                  >
                    <PersonAddIcon />
                  </CollapseToggleButton>
                </Tooltip>
              </ToggleButtonGroup>
            </Stack>

            <Stack
              className="dialog-access-selection"
              direction={"column"}
              spacing={M1}
            >
              <Typography variant="h5">Access</Typography>

              <ToggleButtonGroup aria-label="access options" {...accessControl}>
                <Tooltip title="Recipients can view but not modify">
                  <CollapseToggleButton
                    value="read"
                    sx={{ gap: M2 }}
                    selected={accessType === "read"}
                    whenSelected={
                      <Typography sx={{ whiteSpace: "nowrap", pl: M2 }}>
                        Only Read
                      </Typography>
                    }
                  >
                    <VisibilityIcon />
                  </CollapseToggleButton>
                </Tooltip>

                <Tooltip title="Recipients can view and modify">
                  <CollapseToggleButton
                    value="write"
                    sx={{ gap: M2 }}
                    selected={accessType === "write"}
                    whenSelected={
                      <Typography sx={{ whiteSpace: "nowrap", pl: M2 }}>
                        Can Edit
                      </Typography>
                    }
                  >
                    <EditIcon />
                  </CollapseToggleButton>
                </Tooltip>
              </ToggleButtonGroup>
            </Stack>

            <Stack
              className="dialog-schedule-selection"
              direction={"column"}
              spacing={M1}
            >
              <Typography variant="h5">Expires after</Typography>

              <ToggleButtonGroup {...scheduleControl}>
                {scheduleItems.map((item) => (
                  <CollapseToggleButton
                    key={item.value}
                    value={item.value}
                    replaceChildren
                    selected={activeSeconds === item.value}
                    whenSelected={<Typography>{item.whenSelected}</Typography>}
                  >
                    {item.children}
                  </CollapseToggleButton>
                ))}
              </ToggleButtonGroup>
            </Stack>

            <Stack
              className="dialog-description-selection"
              direction={"column"}
              spacing={M1}
            >
              <Typography variant="h5">Description</Typography>

              <TextField
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                variant="outlined"
              />
            </Stack>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="contained">
          Cancel
        </Button>
        <Button onClick={onShare} color="primary" variant="contained">
          Share
        </Button>
      </DialogActions>
    </Dialog>
  );
};
