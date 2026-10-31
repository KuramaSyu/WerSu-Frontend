import type React from "react";
import type { RestNotesSearchType } from "../../../api/models/search";
import type { DirectoryReply } from "../../../api/models/directory";
import type { CustomTheme } from "../../../theme/customTheme";

/**
 * Body of a search result row.
 *
 * - `string` / `string[]` are rendered as plain text (one line per entry)
 * - a custom node (including an array of nodes) is rendered as-is, which is
 *   how note highlights inject their styled fragments
 */
export type SearchResultContent = string | string[] | React.ReactNode;

/**
 * Everything a `SearchResult` implementation may need to render itself and
 * perform its action. Built once per list render and handed to the result
 * classes so they stay free of hooks.
 */
export interface SearchResultContext {
  theme: CustomTheme;
  /** The debounced query, used for highlighting / fuzzy matching. */
  searchQuery: string;
  /** The active note search strategy (ignored by non-note results). */
  searchType: RestNotesSearchType;
  /** Lookup table used to resolve directory labels / paths. */
  directoriesById: Record<string, DirectoryReply>;
  navigate: (path: string) => void;
  /** Close the search overlay (called by `on_click` after navigating). */
  closeOverlay: () => void;
}

/**
 * Single contract every search result kind implements.
 *
 * The row + list only ever talk to this interface, so adding a new kind
 * (tag, shelf, user, ...) means dropping in another implementation without
 * touching the renderer.
 */
export interface SearchResult {
  /** Stable identity, used as the React key. */
  get_id(): string;
  /** Title shown at the top-left of the row. */
  get_title(): React.ReactNode;
  /** Preview body. See `SearchResultContent` for the accepted shapes. */
  get_content(): SearchResultContent;
  /** Icon rendered in the row's top-right corner, marking the result kind. */
  get_type_icon(): React.ReactNode;
  /** Human label for the type icon (tooltip + accessibility). */
  get_type_label(): string;
  /** Accent colour for the row's left rail. */
  get_accent_color(): string;
  /** Optional metadata chips rendered under the title. */
  get_meta?(): React.ReactNode;
  /** Activate the result: navigate to it and close the overlay. */
  on_click(): void;
}
