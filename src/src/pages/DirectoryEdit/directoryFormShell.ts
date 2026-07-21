import { useEffect, useState } from "react";
import type { DirectoryReply } from "../../api/models/directory";
import {
  useDirectoryListHydration,
  useObjectUrl,
  useParentSelector,
  type UseParentSelectorResult,
} from "./directoryFormShared";

export interface UseDirectoryFormShellOptions {
  /**
   * Optional initial values used to seed the form. Pass an existing
   * `DirectoryReply` for the Edit page to hydrate from; omit for the
   * Create page to start from empty fields.
   */
  initial?: Pick<DirectoryReply, "display_name" | "name" | "slug"> & {
    description?: string;
    image_url?: string;
    parent_dir_ids?: string[];
  };
  /**
   * Initial parent id. Used by the Create page to autoselect the
   * directory the user came from; the Edit page picks it up from
   * `initial.parent_dir_ids[0]` when present.
   */
  initialParentId?: string;
}

export interface UseDirectoryFormShellResult {
  // Hydration
  directoriesById: Record<string, DirectoryReply>;
  sortedDirectories: DirectoryReply[];

  // Form fields
  name: string;
  description: string;
  /** The text field's value. May be a remote URL or a local preview. */
  imageUrl: string;
  /** A locally-picked image that hasn't been uploaded yet (Create flow). */
  pendingImageFile: File | null;
  /** Object URL for `pendingImageFile`, or `null`. */
  pendingImagePreviewUrl: string | null;
  hasPendingImage: boolean;

  // Setters
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  setImageUrl: (value: string) => void;
  setPendingImageFile: (file: File | null) => void;

  // Parent selector
  parent: UseParentSelectorResult;
}

/**
 * Composes the shared building blocks (`directoryFormShared`) into a
 * single form-state contract that both the Edit and Create pages
 * consume. The shell owns the controlled inputs and the parent
 * selector; it does not own save logic, since edit and create
 * differ in what they call (`patch` vs. `create` + optional
 * `linkAttachment`).
 *
 * The caller passes the shell's fields and parent selector into
 * the form UI, then writes its own `handleSave` that reads the
 * current state and dispatches the right API call. The Edit page
 * additionally seeds the form from an existing `DirectoryReply` via
 * `initial`; the Create page leaves the form empty and seeds the
 * parent from the route `:id`.
 */
export function useDirectoryFormShell(
  options: UseDirectoryFormShellOptions = {},
): UseDirectoryFormShellResult {
  const { initial, initialParentId } = options;
  const { directoriesById, sortedDirectories } = useDirectoryListHydration();

  const seedParentId = (() => {
    if (initialParentId) {
      return initialParentId;
    }
    const seed = initial?.parent_dir_ids?.[0];
    return seed ?? undefined;
  })();

  const [name, setName] = useState<string>(
    initial?.display_name ?? initial?.name ?? initial?.slug ?? "",
  );
  const [description, setDescription] = useState<string>(
    initial?.description ?? "",
  );
  const [imageUrl, setImageUrl] = useState<string>(initial?.image_url ?? "");
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);

  const pendingImagePreviewUrl = useObjectUrl(pendingImageFile);

  const parent = useParentSelector(sortedDirectories, {
    initialId: seedParentId,
  });

  // Re-seed the form when `initial` changes — e.g. the Edit page
  // mounts before the single-record query resolves, then the
  // `DirectoryReply` arrives and the form values should snap to
  // it. We do this once per `initial` identity so user edits made
  // after the form mounts are not clobbered. The form body in
  // `Main.tsx` is `key`ed on the route `:id`, so navigating between
  // different Edit / Create pages remounts the whole tree and
  // re-initialises this hook with the new directory's record — this
  // effect is the "single-record fetch resolves after mount" path.
  const [hydratedFor, setHydratedFor] = useState<unknown>(undefined);
  useEffect(() => {
    if (!initial) {
      return;
    }
    if (hydratedFor === initial) {
      return;
    }
    setName(initial.display_name ?? initial.name ?? initial.slug ?? "");
    setDescription(initial.description ?? "");
    setImageUrl(initial.image_url ?? "");
    setHydratedFor(initial);
  }, [initial, hydratedFor]);

  return {
    directoriesById,
    sortedDirectories,
    name,
    description,
    imageUrl,
    pendingImageFile,
    pendingImagePreviewUrl,
    hasPendingImage: pendingImageFile !== null,
    setName,
    setDescription,
    setImageUrl,
    setPendingImageFile,
    parent,
  };
}
