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
import {
  uniquePerDayForCounting,
  usePersonalizationSettings,
} from "../../zustand/usePersonalizationSettings";

/**
 * Left rail for the Home page: the three history blocks (last used,
 * frequently used, recent activity).
 *
 * The first two blocks read their window / algorithm / row count from
 * the Personalize settings, so the user can tune how the rail is built
 * without touching the Home page itself.
 */
export const HomeLeftPanel: React.FC = () => {
  const frequentlyUsedDays = usePersonalizationSettings(
    (state) => state.frequentlyUsedDays,
  );
  const frequentlyUsedAlgorithm = usePersonalizationSettings(
    (state) => state.frequentlyUsedAlgorithm,
  );
  const frequentlyUsedCounting = usePersonalizationSettings(
    (state) => state.frequentlyUsedCounting,
  );
  const frequentlyUsedRailLimit = usePersonalizationSettings(
    (state) => state.frequentlyUsedRailLimit,
  );
  const lastUsedDays = usePersonalizationSettings(
    (state) => state.lastUsedDays,
  );
  const lastUsedRailLimit = usePersonalizationSettings(
    (state) => state.lastUsedRailLimit,
  );

  return (
    <UpperPanel spacing={2.5}>
      <RailSection title="Last used" icon={<HistoryIcon />}>
        <LastUsedPanel
          title={null}
          limit={lastUsedRailLimit}
          days={lastUsedDays}
        />
      </RailSection>

      <RailSection title="Frequently used" icon={<LocalFireDepartmentIcon />}>
        <FrequentlyUsedPanel
          title={null}
          limit={frequentlyUsedRailLimit}
          algorithm={frequentlyUsedAlgorithm}
          uniquePerDay={uniquePerDayForCounting(frequentlyUsedCounting)}
          days={frequentlyUsedDays ?? undefined}
        />
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
};
