import {
  IconLayoutSidebarLeftCollapseFilled,
  IconLayoutSidebarLeftExpandFilled,
} from "@tabler/icons-react";
import { useLayout } from "../LayoutProvider";

export const LeftPanelToggle: React.FC = () => {
  const { leftPanelOpen, setLeftPanelOpen } = useLayout();
  return (
    <>
      {!leftPanelOpen ? (
        <IconLayoutSidebarLeftCollapseFilled
          onClick={() => setLeftPanelOpen(true)}
        />
      ) : (
        <IconLayoutSidebarLeftExpandFilled
          onClick={() => setLeftPanelOpen(false)}
        />
      )}
    </>
  );
};
