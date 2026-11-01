import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { navigationMemento } from "../utils/navigationMemento";

/**
 * Navigate to the previous entry in the app's navigation memento
 * history (the same back stack used by the rail's Back button).
 *
 * No-op when there is nowhere to go back to.
 */
export function useNavigateBack(): () => void {
  const navigate = useNavigate();

  return useCallback(() => {
    const target = navigationMemento.undo();
    if (!target) {
      return;
    }
    navigationMemento.skipNextRecord();
    navigate(target);
  }, [navigate]);
}
