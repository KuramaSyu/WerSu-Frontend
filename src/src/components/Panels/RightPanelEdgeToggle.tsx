import { useLayout } from "../../LayoutProvider";
import { PanelEdgeHandle } from "./PanelEdgeHandle";

/**
 * Collapse / expand handle for the right rail, rendered on the left
 * border of the panel's first section. The tooltip spells out that it
 * collapses the whole rail (all of its boxes), since the handle is
 * visually attached to a single section.
 *
 * The top-bar `RightPanelToggle` remains the primary control; this is
 * an additional, in-context affordance.
 */
export const RightPanelEdgeToggle: React.FC = () => {
  const {
    rightPanel,
    rightPanelOpen,
    setRightPanelOpen,
    setRightPanelUserOverride,
  } = useLayout();

  if (rightPanel === null) {
    return null;
  }

  const handleClick = () => {
    setRightPanelOpen(!rightPanelOpen);
    setRightPanelUserOverride(true);
  };

  return (
    <PanelEdgeHandle
      side="right"
      open={rightPanelOpen}
      onClick={handleClick}
      collapseTitle="Collapse all boxes"
      expandTitle="Expand right panel"
    />
  );
};
