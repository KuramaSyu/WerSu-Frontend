import type { ReactNode } from "react";

/**
 * A single category in the Settings page's left rail.
 *
 * Categories are keyed by `id` so the active-section sync can be done
 * with id equality instead of index lookups when the order changes.
 */
export interface SettingsCategory {
  /** Stable id, also used as the DOM anchor target for scroll-into-view. */
  id: string;
  /** Human-readable label rendered in the left rail and section title. */
  label: string;
  /** Optional icon rendered next to the label. */
  icon?: ReactNode;
  /**
   * Optional callback that resets this category's settings back to
   * their defaults. Wired to the per-section reset button.
   */
  resetLogic?: () => void;
  /** Body content rendered inside the section. */
  settingsContent: ReactNode;
}
