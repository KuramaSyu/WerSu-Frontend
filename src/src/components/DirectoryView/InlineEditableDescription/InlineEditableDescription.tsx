import { Box, CircularProgress, InputBase, Typography } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getDirectoryApi } from "../../../api/DirectoryApi";
import type {
  DirectoryReply,
  PatchDirectoryBody,
} from "../../../api/models/directory";
import { useUserKey } from "../../../api/queries/useUser";
import { invalidateDirectoryQueries } from "../../../pages/DirectoryEdit/directoryFormShared";
import { upsertDirectory } from "../../../api/queries/directoryQueries";
import useInfoStore, { SnackbarUpdateImpl } from "../../../zustand/InfoStore";

interface InlineEditableDescriptionProps {
  directoryId: string;
  initialDescription: string;
}

// Placeholder shown when the field starts empty. Matches the muted paragraph color used elsewhere in the rail.
const EMPTY_PLACEHOLDER = "Add description";

export const InlineEditableDescription: React.FC<
  InlineEditableDescriptionProps
> = ({ directoryId, initialDescription }) => {
  const queryClient = useQueryClient();
  const userKey = useUserKey();
  const setSnackbar = useInfoStore((s) => s.setMessage);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(initialDescription);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Resync draft whenever the server-side description changes from
  // elsewhere (e.g. DirectoryEdit page) while the field isn't in edit
  // mode. Avoid stomping on the user's in-progress edit.
  useEffect(() => {
    if (!isEditing) {
      setDraft(initialDescription);
    }
  }, [initialDescription, isEditing]);

  // Auto-focus + select-all when the field mounts so Enter / Escape /
  // typed characters replace the existing value naturally.
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const mutation = useMutation<
    DirectoryReply | undefined,
    Error,
    string,
    { previous: DirectoryReply | null }
  >({
    mutationFn: async (next) => {
      const body: PatchDirectoryBody = {
        id: directoryId,
        description: next,
      };
      return await getDirectoryApi().patch(body);
    },
    onMutate: async (next) => {
      await queryClient.cancelQueries({
        queryKey: ["directory", directoryId, userKey],
      });
      const previous =
        queryClient.getQueryData<DirectoryReply | null>([
          "directory",
          directoryId,
          userKey,
        ]) ?? null;
      if (previous) {
        queryClient.setQueryData<DirectoryReply | null>(
          ["directory", directoryId, userKey],
          { ...previous, description: next },
        );
      }
      return { previous };
    },
    onError: (_err, _next, ctx) => {
      // Roll back the optimistic update and surface the failure.
      if (ctx?.previous) {
        queryClient.setQueryData<DirectoryReply | null>(
          ["directory", directoryId, userKey],
          ctx.previous,
        );
      }
      setSnackbar(
        new SnackbarUpdateImpl("Failed to update description", "error"),
      );
    },
    onSuccess: (updated) => {
      if (updated) {
        upsertDirectory(queryClient, updated);
      }
      invalidateDirectoryQueries(queryClient, userKey, directoryId);
      setSnackbar(new SnackbarUpdateImpl("Description saved", "success"));
    },
    onSettled: () => {
      setIsEditing(false);
    },
  });

  const enterEdit = () => {
    setDraft(initialDescription);
    setIsEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === initialDescription.trim()) {
      setIsEditing(false);
      return;
    }
    mutation.mutate(trimmed);
  };

  const cancel = () => {
    setDraft(initialDescription);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Box sx={{ position: "relative" }}>
        <InputBase
          inputRef={inputRef}
          value={draft}
          fullWidth
          multiline
          maxRows={6}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          onBlur={commit}
          placeholder={EMPTY_PLACEHOLDER}
          sx={{
            fontSize: "0.8rem",
            color: "text.secondary",
            px: 0,
            py: 0,
            // No outline / border: InputBase draws one by default.
            "& .MuiInputBase-input": {
              padding: 0,
              border: "none",
              outline: "none",
              boxShadow: "none",
              background: "transparent",
            },
          }}
        />
        {mutation.isPending && (
          <CircularProgress
            size={12}
            sx={{
              position: "absolute",
              right: -18,
              top: 4,
              color: "text.secondary",
            }}
          />
        )}
      </Box>
    );
  }

  const isEmpty = initialDescription.trim().length === 0;
  return (
    <Typography
      onClick={enterEdit}
      variant="body2"
      sx={{
        fontSize: "0.8rem",
        cursor: "pointer",
        color: isEmpty ? "text.disabled" : "text.secondary",
        fontStyle: isEmpty ? "italic" : "normal",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        // No visible focus ring / hover background, just text.
        outline: "none",
        userSelect: "none",
        "&:focus": { outline: "none" },
      }}
      tabIndex={0}
      role="textbox"
      aria-label="Directory description"
    >
      {isEmpty ? EMPTY_PLACEHOLDER : initialDescription}
    </Typography>
  );
};
