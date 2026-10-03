// ---------------------------------------------------------------------------
// LatexDialogController
// Owns the LaTeX dialog state and exposes a stable imperative opener
// via triggerRef so math onClick / slash commands can pop the dialog
// without holding a state setter. Lives in its own component so a
// math-node click does not re-render the NoteEditorCore body.
// ---------------------------------------------------------------------------

import { memo, useCallback, useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorMenuStore } from "../../zustand/editorMenuStore";
import { LatexDialog, type LatexDialogProps } from "./LatexDialog";
import { type LatexDialogOpenParams } from "./LatexDialogController.utils";
import { logRerender } from "./editorRenderLog";

export interface LatexDialogControllerProps {
  editor: Editor | null;
  triggerRef: React.MutableRefObject<
    ((params: LatexDialogOpenParams) => void) | null
  >;
}

interface LatexDialogState {
  open: boolean;
  latexCode: string;
  initialLatexType?: "inline" | "block";
  pos: number;
  mode: "edit" | "create";
}

const CLOSED_STATE: LatexDialogState = {
  open: false,
  latexCode: "",
  pos: -1,
  mode: "create",
};

const LatexDialogControllerImpl: React.FC<LatexDialogControllerProps> = ({
  editor,
  triggerRef,
}) => {
  logRerender("LatexDialogController", { hasEditor: !!editor });
  const [state, setState] = useState<LatexDialogState>(CLOSED_STATE);

  // Build the dialog's onClose handler. Pulls the latest editor and
  // state via the closure. The controller is the only place that
  // knows about the math-position routing logic, so it is not
  // duplicated at the call site.
  const handleClose = useCallback(
    (latex: string, type: "inline" | "block") => {
      const live = editor;
      if (!live) {
        setState(CLOSED_STATE);
        return;
      }
      try {
        const chain = live.chain();
        if (state.mode === "edit") {
          chain.setNodeSelection(state.pos);
          if (state.mode === "edit" && state.initialLatexType === "block") {
            if (type === "block") {
              chain.updateBlockMath({ latex });
            } else {
              chain.deleteBlockMath().insertInlineMath({ latex });
            }
          } else {
            if (type === "inline") {
              chain.updateInlineMath({ latex });
            } else {
              chain.deleteInlineMath().insertBlockMath({ latex });
            }
          }
        } else {
          if (type === "inline") {
            chain.insertInlineMath({ latex });
          } else {
            chain.insertBlockMath({ latex });
          }
        }
        chain.focus().run();
      } catch (error) {
        console.error("Failed to apply LaTeX edit", error);
      } finally {
        setState(CLOSED_STATE);
      }
    },
    [editor, state.mode, state.pos, state.initialLatexType],
  );

  const handleCancel = useCallback(() => {
    setState((current) => ({ ...current, open: false }));
  }, []);

  // Imperative opener for math node onClick + slash commands.
  useEffect(() => {
    triggerRef.current = (params) => {
      setState({
        open: true,
        latexCode: params.latex,
        initialLatexType: params.type,
        pos: params.pos,
        mode: params.mode,
      });
    };
    return () => {
      triggerRef.current = null;
    };
  }, [triggerRef]);

  // External request: right-rail button bus. Bumping the counter
  // opens an empty dialog (create mode, no node position).
  const latexDialogRequest = useEditorMenuStore((s) => s.latexDialogRequest);
  // ESLint flags setState in effect; the cascade is intentional and
  // bounded to one extra render per request.
  useEffect(() => {
    if (latexDialogRequest > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({
        ...CLOSED_STATE,
        open: true,
        latexCode: "",
      });
    }
  }, [latexDialogRequest]);

  // Adapter from internal state to the existing LatexDialogProps
  // contract. onClose discards the compressed flag - the controller's
  // state already records the dialog's mode.
  const dialogProps: LatexDialogProps = {
    open: state.open,
    latexCode: state.latexCode,
    initialLatexType: state.initialLatexType,
    onClose: (latex, type) => handleClose(latex, type),
    onCancel: handleCancel,
    setOpen: (open) =>
      setState((current) => (open ? current : { ...current, open: false })),
  };

  return <LatexDialog {...dialogProps} />;
};

export const LatexDialogController = memo(LatexDialogControllerImpl);
