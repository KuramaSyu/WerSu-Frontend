import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AttachmentApi } from "../../api/AttachmentApi";
import { AttachmentLinkBuilder } from "../../api/utils/AttachmentLInkBuilder";
import { getNoteApi } from "../../api/NoteApi";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { README_NOTE_TITLE, serializeReadme } from "../../utils/readme";
import { useDirectoryFormShell } from "../DirectoryEdit/directoryFormShell";
import {
  createDirectoryApi,
  invalidateDirectoryQueries,
  resolveParentIds,
} from "../DirectoryEdit/directoryFormShared";

export interface UseCreateSubdirectoryForm {
  // Form fields (from the shared shell)
  name: string;
  description: string;
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  sortedDirectories: ReturnType<
    typeof useDirectoryFormShell
  >["sortedDirectories"];

  // Parent selector
  parentLabel: string;
  setParent: (value: string) => void;
  parentIsValid: boolean;

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
export function useCreateSubdirectoryForm(): UseCreateSubdirectoryForm {
  const { id } = useParams();
  const navigate = useNavigate();
  const { upsertDirectory } = useDirectoryStore();
  const { setMessage } = useInfoStore();
  const queryClient = useQueryClient();

  // The Create form has no `initial` directory, but the parent
  // selector should autoselect the route's `:id` so the user starts
  // out on the directory they came from. The form's `Main.tsx` keys
  // the form body on the route `:id`, so navigating between Create
  // pages unmounts and remounts the whole tree — this hook
  // re-initialises with the new id and a fresh form.
  const shell = useDirectoryFormShell({
    initialParentId: id,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleSave = async () => {
    const trimmedName = shell.name.trim();
    if (!trimmedName) {
      setMessage(new SnackbarUpdateImpl("Name is required", "warning"));
      return;
    }

    // The parent field is free-text: the user can type any value,
    // even one that doesn't match a known directory. We refuse to
    // create when the value is unresolved so we don't silently
    // assign a non-existent parent.
    if (!shell.parent.parentIsValid) {
      setMessage(
        new SnackbarUpdateImpl(
          `Parent directory "${shell.parent.parentLabel}" does not exist. Pick a directory from the list, or clear the field for top level.`,
          "error",
        ),
      );
      return;
    }

    const parentIds = resolveParentIds(shell.parent.resolveForPayload());

    setIsSaving(true);
    try {
      // 1. Create the directory. We deliberately leave `image_url`
      //    unset in the initial create so the README + attachment
      //    flow below can fill it in with the final markdown URL.
      //    `parent_ids` accepts `undefined` to mean top-level; the
      //    helper returns `null` for the wire shape, so we coerce.
      const created = await createDirectoryApi().create({
        name: trimmedName,
        display_name: trimmedName,
        description: shell.description || undefined,
        parent_ids: parentIds ?? undefined,
      });

      if (!created) {
        setMessage(
          new SnackbarUpdateImpl("Failed to create subdirectory", "error"),
        );
        return;
      }

      let finalImageUrl: string | undefined = shell.imageUrl || undefined;

      // 2. If a file is pending, upload it, create the directory's
      //    README so we have a stable target to `linkAttachment` to,
      //    and patch the directory with the resulting markdown URL.
      if (shell.pendingImageFile) {
        setIsUploadingImage(true);
        try {
          const noteApi = getNoteApi();
          const attachmentApi = new AttachmentApi();

          // 2a. Create the README note with the auto-generated
          //     header. The image placeholder is omitted from the
          //     header here; we patch it back in once the upload
          //     resolves the final URL.
          const readmePlaceholder = serializeReadme(
            {
              name: trimmedName,
              description: shell.description,
              imageUrl: undefined,
            },
            "",
          );
          const readme = await noteApi.post(
            README_NOTE_TITLE,
            readmePlaceholder,
          );
          const moved = await noteApi.patchDirectory(readme.id, created.id);
          if (!moved) {
            setMessage(
              new SnackbarUpdateImpl(
                "Directory created, but failed to attach README",
                "warning",
              ),
            );
          }

          // 2b. Upload the file to attachment storage.
          const metadata = await attachmentApi.createAttachment(
            shell.pendingImageFile,
          );
          if (!metadata) {
            setMessage(
              new SnackbarUpdateImpl(
                "Directory created, but image upload failed",
                "warning",
              ),
            );
          } else {
            // 2c. Link the attachment to the README so it shows up
            //     in the note's attachment list.
            const linked = await attachmentApi.linkAttachment({
              attachment_key: metadata.key,
              note_id: readme.id,
            });
            if (linked === null) {
              setMessage(
                new SnackbarUpdateImpl(
                  "Image uploaded, but failed to link to README",
                  "warning",
                ),
              );
            }

            // 2d. Build the markdown URL the directory's `image_url`
            //     field stores.
            const markdownUrl = new AttachmentLinkBuilder(attachmentApi)
              .asMarkdown()
              .setWidth(720)
              .getLink(metadata.key);
            finalImageUrl = markdownUrl;
          }
        } finally {
          setIsUploadingImage(false);
        }
      }

      // 3. If we ended up with a different image URL than the user
      //    typed (or no `imageUrl` was typed but we uploaded a file),
      //    patch the directory so the final URL is persisted.
      const originalImageUrl = shell.imageUrl || undefined;
      const originalDescription = created.description ?? "";
      if (
        finalImageUrl !== originalImageUrl ||
        shell.description !== originalDescription
      ) {
        const updated = await createDirectoryApi().patch({
          id: created.id,
          display_name: trimmedName,
          description: shell.description || undefined,
          image_url: finalImageUrl,
        });
        if (updated) {
          upsertDirectory(updated);
        }
      } else {
        upsertDirectory(created);
      }

      invalidateDirectoryQueries(queryClient, created.id, parentIds?.[0]);

      setMessage(new SnackbarUpdateImpl("Subdirectory created", "success"));
      navigate(`/d/${created.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  return {
    name: shell.name,
    description: shell.description,
    setName: shell.setName,
    setDescription: shell.setDescription,
    sortedDirectories: shell.sortedDirectories,
    parentLabel: shell.parent.parentLabel,
    setParent: shell.parent.setParent,
    parentIsValid: shell.parent.parentIsValid,
    hasPendingImage: shell.hasPendingImage,
    imagePreviewUrl: shell.pendingImagePreviewUrl,
    setPendingImageFile: shell.setPendingImageFile,
    isSaving,
    isUploadingImage,
    handleSave,
    handleCancel,
  };
}
