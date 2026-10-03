// ---------------------------------------------------------------------------
// useEditorSlashCommands
// Returns the slash-command list (image upload, inline LaTeX, block
// LaTeX). Memoized so a fresh array per render does not retrigger
// BubbleMenu plugin teardown on every keystroke.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import type { Editor } from "@tiptap/core";
import { useDialog } from "./InputDialog";
import {
  clearSlashCommand,
  clearSlashLine,
  type SlashCommand,
} from "../../components/Editor/SlashCommandMenu";
import { type LatexDialogOpenParams } from "./LatexDialogController.utils";

export interface UseEditorSlashCommandsParams {
  latexOpenerRef: React.MutableRefObject<
    ((params: LatexDialogOpenParams) => void) | null
  >;
}

export const useEditorSlashCommands = (
  params: UseEditorSlashCommandsParams,
): SlashCommand[] => {
  const { latexOpenerRef } = params;
  const openDialog = useDialog();

  return useMemo<SlashCommand[]>(() => {
    const openLatex = (slashEditor: Editor, type: "inline" | "block") => {
      if (type === "inline") {
        clearSlashCommand(slashEditor);
      } else {
        clearSlashLine(slashEditor);
      }
      latexOpenerRef.current?.({
        latex: "",
        type,
        pos: -1,
        mode: "create",
      });
    };

    const imageUploadCommand: SlashCommand = {
      id: "image",
      label: "Image / Attachment",
      keywords: ["image", "upload", "attachment", "picture", "file", "media"],
      run: async (slashEditor) => {
        clearSlashLine(slashEditor);

        const result = await openDialog({
          title: "Upload Image / Attachment",
          mode: "file",
          accept: "image/*",
          dropText: "Drag an image here",
          dropHint: "or click to browse",
          confirmLabel: "Upload",
        });

        if (!(result instanceof File)) return;
        if (!slashEditor) return;

        slashEditor.chain().focus().uploadAttachment(result).run();
      },
    };

    const latexInlineCommand: SlashCommand = {
      id: "latex-inline",
      label: "LaTeX inline",
      keywords: ["latex", "inline", "math", "formula", "equation"],
      getCommandName: () => "/latex inline",
      run: (slashEditor) => openLatex(slashEditor, "inline"),
    };

    const latexBlockCommand: SlashCommand = {
      id: "latex-block",
      label: "LaTeX block",
      keywords: ["latex", "block", "display", "math", "formula", "equation"],
      getCommandName: () => "/latex block",
      run: (slashEditor) => openLatex(slashEditor, "block"),
    };

    return [imageUploadCommand, latexInlineCommand, latexBlockCommand];
  }, [openDialog, latexOpenerRef]);
};
