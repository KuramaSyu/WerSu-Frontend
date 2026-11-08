import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AttachmentApi } from "../../api/AttachmentApi";
import { AttachmentLinkBuilder } from "../../api/utils/AttachmentLInkBuilder";
import { getNoteApi } from "../../api/NoteApi";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import {
  README_NOTE_TITLE,
  README_SENTINEL,
  serializeReadme,
} from "../../utils/readme";
import { useUserKey } from "../../api/queries/useUser";
import { useDirectoryFormShell } from "../DirectoryEdit/directoryFormShell";
import {
  createDirectoryApi,
  invalidateDirectoryQueries,
} from "../DirectoryEdit/directoryFormShared";
import { upsertDirectory } from "../../api/queries/directoryQueries";

export interface UseCreateSubdirectoryFormOptions {
  /**
   * Optional override for the parent the new directory should be
   * created under. When omitted, the hook falls back to the route
   * `:id` param (the existing route-driven behaviour). The
   * `CreateDirectoryModal` passes this in directly so it can mount
   * the create flow from any page.
   */
  parentId?: string;
  /**
   * Optional cancel handler. When provided, it runs instead of the
   * default `navigate(-1)`. The modal uses this to close the dialog
   * without leaving the host page.
   */
  onCancel?: () => void;
}

export interface UseCreateSubdirectoryForm {
  // Form fields (from the shared shell)
  name: string;
  description: string;
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  sortedDirectories: ReturnType<
    typeof useDirectoryFormShell
  >["sortedDirectories"];

  // Parent selector (multi-id chips)
  parentIds: string[];
  setParentIds: (ids: string[]) => void;
  parentIsValid: boolean;

  // Shelf selector
  shelves: ReturnType<typeof useDirectoryFormShell>["shelves"];
  shelfIds: string[];
  setShelfIds: (ids: string[]) => void;

  // Local pending image
  hasPendingImage: boolean;
  imagePreviewUrl: string | null;
  setPendingImageFile: (file: File | null) => void;

  // Save / cancel
  isSaving: boolean;
  isUploadingImage: boolean;
  handleSave: () => Promise<void>;
  handleCancel: () => void;
}

/**
 * Owns the `CreateSubdirectory` form's data flow:
 *
 * - composes the shared `useDirectoryFormShell` to get the standard
 *   form fields, parent selector, and directory list hydration
 * - seeds the parent selector with the route's `:id` so the user
 *   starts out on the directory they came from
 * - holds a pending image `File` in shell state until the user saves
 * - on save: POST the directory, then (if a file is pending)
 *   upload + link it to a freshly-created README and PATCH the
 *   directory's `image_url` to the resulting markdown URL
 *
 * The view is presentational; all state and side effects live here.
 */
export function useCreateSubdirectoryForm(
  options: UseCreateSubdirectoryFormOptions = {},
): UseCreateSubdirectoryForm {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { setMessage } = useInfoStore();
  const queryClient = useQueryClient();
  const userKey = useUserKey();

  // The Create form has no `initial` directory, but the parent
  // selector should autoselect the route's `:id` so the user starts
  // out on the directory they came from. An explicit `parentId`
  // option overrides the route param — the modal uses this when it
  // mounts the create flow outside a `/d/:id/new` route.
  const seedParentId = options.parentId ?? routeId;

  const shell = useDirectoryFormShell({
    initialParentId: seedParentId,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleSave = async () => {
    const trimmedName = shell.name.trim();
    if (!trimmedName) {
      setMessage(new SnackbarUpdateImpl("Name is required", "warning"));
      return;
    }

    // The parent list is chip-based: every selected id must resolve
    // to a known directory. We refuse to create otherwise so we
    // don't silently assign a non-existent parent.
    if (!shell.parent.parentIsValid) {
      setMessage(
        new SnackbarUpdateImpl(
          "One or more selected parents are unknown. Pick from the list or clear the chips.",
          "error",
        ),
      );
      return;
    }

    const parentIds = shell.parent.resolveForPayload();

    setIsSaving(true);
    try {
      // 1. Create the directory. We deliberately leave `image_url`
      //    unset in the initial create so the README + attachment
      //    flow below can fill it in with the final image URL.
      //    `parent_ids` accepts `undefined` to mean top-level; the
      //    helper returns `null` for the wire shape, so we coerce.
      let created;
      try {
        created = await createDirectoryApi().create({
          name: trimmedName,
          display_name: trimmedName,
          description: shell.description || undefined,
          parent_ids: parentIds ?? undefined,
          // Forward shelf memberships on create so a single round-trip
          // carries the full directory record.
          shelf_ids: shell.shelfIds.length > 0 ? shell.shelfIds : undefined,
        });
      } catch (error) {
        console.error("Failed to create chapter", error);
        setMessage(
          new SnackbarUpdateImpl("Failed to create chapter", "error"),
        );
        return;
      }

      if (!created) {
        setMessage(
          new SnackbarUpdateImpl("Failed to create chapter", "error"),
        );
        return;
      }

      let finalImageUrl: string | undefined = shell.imageUrl || undefined;

      // 2. If a file is pending, upload it and link it to the
      //    directory's README. The backend creates the README on
      //    directory create, but the create reply may omit
      //    `child_note_ids` (the REST layer uses `omitempty`), so we
      //    resolve the README defensively instead of indexing into a
      //    possibly-undefined array.
      if (shell.pendingImageFile) {
        setIsUploadingImage(true);
        try {
          const attachmentApi = new AttachmentApi();
          const noteApi = getNoteApi();

          // 2a. Resolve the README id. Prefer the directory's note list
          //     (the README is filtered out of most UI views but is
          //     still returned here), then fall back to the create
          //     reply's first child note, then create one ourselves.
          let readmeId: string | null = null;

          const notesReply = await createDirectoryApi().listNotes(
            created.id,
            { limit: 100 },
          );
          readmeId =
            notesReply.notes.find((note) => note.title === README_NOTE_TITLE)
              ?.id ?? null;

          if (!readmeId) {
            const candidateId = created.child_note_ids?.[0] ?? null;
            if (candidateId) {
              const candidate = await noteApi.get(candidateId);
              if (candidate?.title === README_NOTE_TITLE) {
                readmeId = candidateId;
              }
            }
          }

          if (!readmeId) {
            const readme = await noteApi.post(
              README_NOTE_TITLE,
              serializeReadme(
                {
                  name: trimmedName,
                  description: shell.description,
                  imageUrl: undefined,
                },
                "",
              ),
              { directory_ids: [created.id] },
            );
            readmeId = readme.id;
          }

          if (!readmeId) {
            setMessage(
              new SnackbarUpdateImpl(
                "Chapter created, but could not resolve the README note",
                "warning",
              ),
            );
          } else {
            // 2b. Upload the file to attachment storage.
            const metadata = await attachmentApi.createAttachment(
              shell.pendingImageFile,
            );
            if (!metadata) {
              setMessage(
                new SnackbarUpdateImpl(
                  "Chapter created, but image upload failed",
                  "warning",
                ),
              );
            } else {
              // 2c. Link the attachment to the README.
              const linked = await attachmentApi.linkAttachment({
                attachment_key: metadata.key,
                note_id: readmeId,
              });
              if (linked === null) {
                setMessage(
                  new SnackbarUpdateImpl(
                    "Image uploaded, but failed to link to README",
                    "warning",
                  ),
                );
              }

              // 2d. The directory's `image_url` stores the raw image
              //     URL; the README header stores the markdown variant.
              const rawImageUrl = new AttachmentLinkBuilder(attachmentApi)
                .setWidth(720)
                .getLink(metadata.key);
              finalImageUrl = rawImageUrl;

              // 2e. Refresh the README header so the image also shows
              //     up when the README note is opened. Preserve the
              //     user-authored body below the sentinel when one was
              //     returned by the backend.
              let readmeBody = "";
              try {
                const existingReadme = await noteApi.get(readmeId);
                const sentinelIndex =
                  existingReadme?.content.indexOf(README_SENTINEL) ?? -1;
                if (sentinelIndex >= 0) {
                  readmeBody = existingReadme!.content
                    .slice(sentinelIndex + README_SENTINEL.length)
                    .trim();
                }
              } catch {
                // Non-fatal: fall back to an empty body.
              }

              await noteApi.patch(
                readmeId,
                README_NOTE_TITLE,
                serializeReadme(
                  {
                    name: trimmedName,
                    description: shell.description,
                    imageUrl: rawImageUrl,
                  },
                  readmeBody,
                ),
              );
            }
          }
        } catch (error) {
          console.error(
            "Failed to prepare the README for the image upload",
            error,
          );
          setMessage(
            new SnackbarUpdateImpl(
              "Chapter created, but the image could not be uploaded",
              "warning",
            ),
          );
        } finally {
          setIsUploadingImage(false);
        }
      }

      // 3. Patch the directory so the final image URL, description and
      //    shelf memberships are persisted. The create reply may omit
      //    `shelf_ids`, so compare against it and patch when anything
      //    differs (or when shelves were selected at all).
      const originalImageUrl = shell.imageUrl || undefined;
      const originalDescription = created.description ?? "";
      const createdShelfIds = created.shelf_ids ?? [];
      const shelvesChanged =
        shell.shelfIds.length > 0 &&
        (createdShelfIds.length !== shell.shelfIds.length ||
          createdShelfIds.some((id, index) => id !== shell.shelfIds[index]));

      if (
        finalImageUrl !== originalImageUrl ||
        shell.description !== originalDescription ||
        shelvesChanged
      ) {
        try {
          const updated = await createDirectoryApi().patch({
            id: created.id,
            display_name: trimmedName,
            description: shell.description || undefined,
            image_url: finalImageUrl,
            shelf_ids: shell.shelfIds.length > 0 ? shell.shelfIds : undefined,
          });
          if (updated) {
            upsertDirectory(queryClient, updated);
          }
        } catch (error) {
          // The directory already exists; keep the create reply so the
          // redirect still happens and the user can retry the edit.
          console.error("Failed to finalize the new chapter", error);
          upsertDirectory(queryClient, created);
        }
      } else {
        upsertDirectory(queryClient, created);
      }

      invalidateDirectoryQueries(
        queryClient,
        userKey,
        created.id,
        parentIds?.[0],
      );
      // Invalidate shelf queries so the new directory shows up
      // (or disappears from) every shelf's book list.
      queryClient.invalidateQueries({ queryKey: ["shelves"] });

      setMessage(new SnackbarUpdateImpl("Chapter created", "success"));
      navigate(`/d/${created.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (options.onCancel) {
      options.onCancel();
      return;
    }
    navigate(-1);
  };

  return {
    name: shell.name,
    description: shell.description,
    setName: shell.setName,
    setDescription: shell.setDescription,
    sortedDirectories: shell.sortedDirectories,
    parentIds: shell.parent.parentIds,
    setParentIds: shell.parent.setParentIds,
    parentIsValid: shell.parent.parentIsValid,
    shelves: shell.shelves,
    shelfIds: shell.shelfIds,
    setShelfIds: shell.setShelfIds,
    hasPendingImage: shell.hasPendingImage,
    imagePreviewUrl: shell.pendingImagePreviewUrl,
    setPendingImageFile: shell.setPendingImageFile,
    isSaving,
    isUploadingImage,
    handleSave,
    handleCancel,
  };
}
