import { Collapse, Stack } from "@mui/material";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useThemeStore } from "../../zustand/useThemeStore";
import { CollabStatusBadge } from "./CollabStatusBadge";

/**
 * Slim editor header. The Save / Share / overflow controls moved
 * into `NoteRightPanelHeader` (mounted at the top of the right
 * rail) so the editor's title row stays focused on the title +
 * collab status. The `editMode` watcher stays here because the
 * collab badge belongs visually with the editor canvas.
 */
export const NoteButtonActionRow: React.FC = () => {
  // Read/write mode is no longer toggled from this row -- it's
  // driven by the standalone FAB in the editor canvas and by the
  // `?mode=write` URL query param. We only read it here so the
  // CollabStatusBadge collapse below can mirror it.
  const { editMode: write } = useEditorSettings();
  const { theme } = useThemeStore();
  return (
    <Stack
      direction={"column"}
      spacing={theme.spacing(0.5)}
      sx={{ alignItems: "flex-start" }}
    >
      {/* Collab badge — hidden in read mode; the Collapse animation
          matches the editor's `theme.transitions.duration.complex`
          so it slides in without competing with the editor mount. */}
      <Collapse
        in={write}
        timeout={theme.transitions.duration.complex}
        mountOnEnter
        unmountOnExit
      >
        <CollabStatusBadge />
      </Collapse>
    </Stack>
  );
};
