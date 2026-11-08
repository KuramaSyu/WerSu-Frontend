import HistoryIcon from "@mui/icons-material/History";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { UpperPanel } from "../../components/Panels/UpperPanel";
import { RailSection } from "../../components/Panels/RailSection";
import {
  FrequentlyUsedPanel,
  LastUsedPanel,
} from "../../components/FrequentlyUsed/Main";
import { RecentActivityPanel } from "../../components/RecentActivity/Main";

/**
 * Left rail for the Home page: the three history blocks (last used,
 * frequently used, recent activity).
 */
export const HomeLeftPanel: React.FC = () => (
  <UpperPanel spacing={2.5}>
    <RailSection
      title="Last used"
      description="Notes you touched most recently."
      icon={<HistoryIcon />}
    >
      <LastUsedPanel title={null} />
    </RailSection>

    <RailSection
      title="Frequently used"
      description="Notes you keep coming back to."
      icon={<LocalFireDepartmentIcon />}
    >
      <FrequentlyUsedPanel title={null} />
    </RailSection>

    <RailSection
      title="Recent activity"
      description="Latest edits, views and moves."
      icon={<ScheduleIcon />}
    >
      <RecentActivityPanel title={null} target={{ type: "root" }} />
    </RailSection>
  </UpperPanel>
);
