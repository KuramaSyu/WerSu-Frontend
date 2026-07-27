import {
  IconLayoutSidebarLeftCollapseFilled,
  IconLayoutSidebarLeftExpandFilled,
  IconLayoutSidebarRightCollapseFilled,
  IconLayoutSidebarRightExpandFilled,
} from "@tabler/icons-react";
import { useLayout } from "../../LayoutProvider";
import Box from "@mui/material/Box";
import { M1 } from "../../statics";
import { IconButton, Tooltip } from "@mui/material";
import { useThemeStore } from "../../zustand/useThemeStore";

export const LeftPanelToggle: React.FC = () => {
  const { leftPanel, leftPanelOpen, setLeftPanelOpen } = useLayout();
  const { theme } = useThemeStore();
  // The toggle only makes sense when something is actually mounted
  // in the left panel. Without this guard the icon shows on every
  // route even when no left panel is wired up, which is confusing
  // and offers no real action.
  if (leftPanel === null) {
    return null;
  }
  return (
    <Tooltip title={leftPanelOpen ? "Close left panel" : "Open left panel"}>
      <IconButton
        onClick={() => setLeftPanelOpen(!leftPanelOpen)}
        sx={{
          padding: M1,
        }}
      >
        {leftPanelOpen ? (
          <IconLayoutSidebarLeftCollapseFilled
            size={theme.typography.h4.fontSize}
          />
        ) : (
          <IconLayoutSidebarLeftExpandFilled
            size={theme.typography.h4.fontSize}
          />
        )}
      </IconButton>
    </Tooltip>
  );
};

export const RightPanelToggle: React.FC = () => {
  const { rightPanel, rightPanelOpen, setRightPanelOpen } = useLayout();
  const { theme } = useThemeStore();
  // Same guard as `LeftPanelToggle`: the right-side collapse icon
  // is only useful when a panel is actually mounted on the right.
  if (rightPanel === null) {
    return null;
  }
  return (
    <Tooltip title={rightPanelOpen ? "Close right panel" : "Open right panel"}>
      <IconButton
        onClick={() => setRightPanelOpen(!rightPanelOpen)}
        sx={{
          padding: M1,
        }}
      >
        {rightPanelOpen ? (
          <IconLayoutSidebarRightCollapseFilled
            size={theme.typography.h4.fontSize}
          />
        ) : (
          <IconLayoutSidebarRightExpandFilled
            size={theme.typography.h4.fontSize}
          />
        )}
      </IconButton>
    </Tooltip>
  );
};
