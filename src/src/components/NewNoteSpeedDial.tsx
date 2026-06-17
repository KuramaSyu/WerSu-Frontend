import { useState } from "react";
import { SpeedDial, SpeedDialAction, SpeedDialIcon } from "@mui/material";
import CreateIcon from "@mui/icons-material/Create";
import { CreateNote } from "../pages/MainPage/CreateNote";

const NewNoteSpeedDial: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <SpeedDial
        ariaLabel="New note actions"
        icon={<SpeedDialIcon />}
        direction="up"
        open={open}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        sx={{
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: (theme) => theme.zIndex.appBar + 2,
        }}
      >
        <SpeedDialAction
          icon={<CreateIcon />}
          slotProps={{
            tooltip: {
              title: "New Note",
            },
          }}
          onClick={() => {
            setDialogOpen(true);
            setOpen(false);
          }}
        />
      </SpeedDial>

      <CreateNote open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
};

export default NewNoteSpeedDial;
