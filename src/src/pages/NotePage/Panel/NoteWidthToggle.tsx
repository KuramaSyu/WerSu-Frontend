import { IconButton, Tooltip } from "@mui/material";
import WidthNormalIcon from "@mui/icons-material/WidthNormal";
import WidthWideIcon from "@mui/icons-material/WidthWide";
import WidthFullIcon from "@mui/icons-material/WidthFull";
import type { NoteWidthMode } from "../../../api/models/ViewConfig";
import { NOTE_WIDTH_STATES } from "./noteWidthMode";
import { useNoteWidthMode } from "./useNoteWidthMode";

/**
 * Icon for each width state.
 *
 * Kept here, next to the button, rather than on the state objects so
 * `noteWidthMode.ts` stays a side-effect-free module that unit tests
 * can import without dragging in MUI's ESM graph. The state still
 * drives *which* icon (via `state.id`).
 */
const WIDTH_MODE_ICONS: Record<NoteWidthMode, typeof WidthNormalIcon> = {
  normal: WidthNormalIcon,
  wide: WidthWideIcon,
  full: WidthFullIcon,
};

/**
 * Single-button editor width control.
 *
 * Clicking cycles `normal -> wide -> full -> normal`. The icon reflects
 * the current state and the tooltip always names it
 * ("Current: Normal" / "Current: Wide" / "Current: Full").
 *
 * `full` is a state-managed layout: the transition controller
 * (`useNoteWidthMode`) collapses the side panels so `full` is genuinely
 * the widest state, and restores them when leaving it.
 */
export const NoteWidthToggle: React.FC = () => {
  const { widthMode, cycleWidthMode } = useNoteWidthMode();
  const state = NOTE_WIDTH_STATES[widthMode] ?? NOTE_WIDTH_STATES.normal;
  const Icon = WIDTH_MODE_ICONS[state.id] ?? WidthNormalIcon;

  return (
    <Tooltip title={state.tooltip}>
      <IconButton aria-label="Change editor width" onClick={cycleWidthMode}>
        <Icon />
      </IconButton>
    </Tooltip>
  );
};
