import {
  IconLayoutSidebarLeftCollapseFilled,
  IconLayoutSidebarLeftExpandFilled,
  IconLayoutSidebarRightCollapseFilled,
  IconLayoutSidebarRightExpandFilled,
} from "@tabler/icons-react";
import { useLayout } from "../LayoutProvider";
import Box from "@mui/material/Box";
import { M1 } from "../statics";
import { IconButton, Tooltip } from "@mui/material";
import { useThemeStore } from "../zustand/useThemeStore";

export const LeftPanelToggle: React.FC = () => {
  const { leftPanelOpen, setLeftPanelOpen } = useLayout();
  const { theme } = useThemeStore();
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
  const { rightPanelOpen, setRightPanelOpen } = useLayout();
  const { theme } = useThemeStore();
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
