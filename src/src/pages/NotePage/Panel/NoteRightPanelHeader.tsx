import { PanelSection } from "../../../components/Panels/PanelSection";
import { NoteActionsToolbar } from "./NoteActionsToolbar";

/**
 * Top-of-right-panel action row.
 *
 * Hosts the :class:`NoteActionsToolbar` under an "Actions" section
 * title. The toolbar registers itself with :class:`useTopBarStore`
 * on mount so the desktop top bar picks up the same widget when
 * the rail collapses -- the rail copy stays here so the
 * right-panel section title still reads as "Actions" when the
 * rail is open, and the top-bar copy takes over the visual once
 * the rail collapses.
 */
export const NoteRightPanelHeader: React.FC = () => {
  return (
    <PanelSection title="Actions">
      <NoteActionsToolbar />
    </PanelSection>
  );
};
