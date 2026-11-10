import { IconButton, Tooltip } from "@mui/material";
import WidthNormalIcon from "@mui/icons-material/WidthNormal";
import WidthWideIcon from "@mui/icons-material/WidthWide";
import WidthFullIcon from "@mui/icons-material/WidthFull";
import type { WidthMode } from "../../api/models/ViewConfig";
import { SHELF_WIDTH_STATES } from "./shelfWidthMode";
import { useShelfWidthMode } from "./useShelfWidthMode";

/**
 * Icon for each width state, keyed by `state.id` so `shelfWidthMode.ts`
 * stays free of MUI imports.
 */
const WIDTH_MODE_ICONS: Record<WidthMode, typeof WidthNormalIcon> = {
  normal: WidthNormalIcon,
  wide: WidthWideIcon,
  full: WidthFullIcon,
};

/**
 * Shelf settings width control, mounted in the top bar.
 *
 * Clicking cycles `normal -> wide -> full -> normal`; the icon reflects
 * the current preset and the tooltip names it ("Current: Normal" / …).
 * The width itself is read from the same store by `ShelfTabs`.
 */
export const ShelfWidthToggle: React.FC = () => {
  const widthMode = useShelfWidthMode((s) => s.widthMode);
  const cycleWidthMode = useShelfWidthMode((s) => s.cycleWidthMode);
  const state = SHELF_WIDTH_STATES[widthMode] ?? SHELF_WIDTH_STATES.normal;
  const Icon = WIDTH_MODE_ICONS[state.id] ?? WidthNormalIcon;

  return (
    <Tooltip title={state.tooltip}>
      <IconButton
        aria-label="Change shelf settings width"
        onClick={cycleWidthMode}
      >
        <Icon />
      </IconButton>
    </Tooltip>
  );
};

export default ShelfWidthToggle;
