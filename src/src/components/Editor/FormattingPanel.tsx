// Formatting panel for the right rail of the note page.
// Reads the live editor from useActiveNoteStore and renders the common
// formatting buttons as small clusters. Re-renders only when the
// selected flags flip via useEditorState.

import { Divider, ToggleButtonGroup, Typography } from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import StrikeThroughIcon from "@mui/icons-material/FormatStrikethrough";
import CodeIcon from "@mui/icons-material/Code";
import BorderColorIcon from "@mui/icons-material/BorderColor";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import ChecklistIcon from "@mui/icons-material/Checklist";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import TableChartIcon from "@mui/icons-material/TableChart";
import ImageIcon from "@mui/icons-material/Image";
import FunctionsIcon from "@mui/icons-material/Functions";
import { useEditorState } from "@tiptap/react";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useEditorMenuStore } from "../../zustand/editorMenuStore";
import { PanelSection } from "../Panels/PanelSection";
import {
  FORMATTING_CONTEXTS,
  TippedToggle,
  pickFormattingContext,
} from "./formattingPanelControls";

export interface FormattingPanelProps {
  /** Optional control rendered on the section's left border. */
  leftEdgeHandle?: React.ReactNode;
}

export const FormattingPanel: React.FC<FormattingPanelProps> = ({
  leftEdgeHandle,
}) => {
  const editor = useActiveNoteStore((s) => s.editor);
  const viewMode = useEditorSettings((s) => s.viewMode);
  const editMode = useEditorSettings((s) => s.editMode);
  const openFileDialog = useEditorMenuStore((s) => s.openFileDialog);
  const openLatexDialog = useEditorMenuStore((s) => s.openLatexDialog);

  const flags = useEditorState({
    editor,
    selector: (ctx) => {
      const e = ctx.editor;
      if (!e) {
        return null;
      }
      return {
        isBold: e.isActive("bold"),
        isItalic: e.isActive("italic"),
        isStrike: e.isActive("strike"),
        isCode: e.isActive("code"),
        isHighlight: e.isActive("highlight"),
        headingLevel: e.isActive("heading", { level: 1 })
          ? 1
          : e.isActive("heading", { level: 2 })
            ? 2
            : e.isActive("heading", { level: 3 })
              ? 3
              : 0,
        isBulletList: e.isActive("bulletList"),
        isOrderedList: e.isActive("orderedList"),
        isTaskList: e.isActive("taskList"),
        isBlockquote: e.isActive("blockquote"),
        activeContextId: pickFormattingContext(e)?.id ?? null,
      };
    },
  });

  if (!editor || !flags) {
    return null;
  }
  // Hide the whole panel in read mode: every button would be disabled
  // anyway, so the cluster adds visual noise without a way to act.
  if (!editMode) {
    return null;
  }
  const disabled = !editor.isEditable || viewMode !== "rich";

  const activeContext = flags.activeContextId
    ? FORMATTING_CONTEXTS.find(
        (context) => context.id === flags.activeContextId,
      ) ?? null
    : null;
  const ContextTools = activeContext?.Component ?? null;

  return (
    <PanelSection
      title="Formatting"
      collapsible
      defaultExpanded
      spacing={1}
      bordered
      leftEdgeHandle={leftEdgeHandle}
    >
      {ContextTools && (
        <Divider textAlign="left" sx={{ my: 0.5 }}>
          {activeContext?.label}
        </Divider>
      )}

      {ContextTools && <ContextTools editor={editor} disabled={disabled} />}

      {ContextTools && (
        <Divider textAlign="left" sx={{ my: 0.5 }}>
          General
        </Divider>
      )}

      <ToggleButtonGroup size="small" color="primary">
        <TippedToggle
          title="Bold"
          ariaLabel="bold"
          value="bold"
          selected={flags.isBold}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <FormatBoldIcon fontSize="small" />
        </TippedToggle>
        <TippedToggle
          title="Italic"
          ariaLabel="italic"
          value="italic"
          selected={flags.isItalic}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <FormatItalicIcon fontSize="small" />
        </TippedToggle>
        <TippedToggle
          title="Strikethrough"
          ariaLabel="strike"
          value="strike"
          selected={flags.isStrike}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <StrikeThroughIcon fontSize="small" />
        </TippedToggle>
        <TippedToggle
          title="Inline code"
          ariaLabel="code"
          value="code"
          selected={flags.isCode}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <CodeIcon fontSize="small" />
        </TippedToggle>
        <TippedToggle
          title="Highlight"
          ariaLabel="highlight"
          value="highlight"
          selected={flags.isHighlight}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <BorderColorIcon fontSize="small" />
        </TippedToggle>
      </ToggleButtonGroup>

      <ToggleButtonGroup
        size="small"
        color="primary"
        exclusive
        value={flags.headingLevel === 0 ? null : flags.headingLevel}
      >
        <TippedToggle
          title="Heading 1"
          ariaLabel="heading 1"
          value="1"
          disabled={disabled}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            H1
          </Typography>
        </TippedToggle>
        <TippedToggle
          title="Heading 2"
          ariaLabel="heading 2"
          value="2"
          disabled={disabled}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            H2
          </Typography>
        </TippedToggle>
        <TippedToggle
          title="Heading 3"
          ariaLabel="heading 3"
          value="3"
          disabled={disabled}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            H3
          </Typography>
        </TippedToggle>
      </ToggleButtonGroup>

      <ToggleButtonGroup size="small" color="primary">
        <TippedToggle
          title="Bullet list"
          ariaLabel="bullet list"
          value="bullet"
          selected={flags.isBulletList}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <FormatListBulletedIcon fontSize="small" />
        </TippedToggle>
        <TippedToggle
          title="Numbered list"
          ariaLabel="numbered list"
          value="ordered"
          selected={flags.isOrderedList}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <FormatListNumberedIcon fontSize="small" />
        </TippedToggle>
        <TippedToggle
          title="Task list"
          ariaLabel="task list"
          value="task"
          selected={flags.isTaskList}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <ChecklistIcon fontSize="small" />
        </TippedToggle>
        <TippedToggle
          title="Blockquote"
          ariaLabel="blockquote"
          value="quote"
          selected={flags.isBlockquote}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <FormatQuoteIcon fontSize="small" />
        </TippedToggle>
      </ToggleButtonGroup>

      <ToggleButtonGroup size="small" color="primary">
        <TippedToggle
          title="Insert table"
          ariaLabel="insert table"
          value="table"
          disabled={disabled}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          <TableChartIcon fontSize="small" />
        </TippedToggle>
        <TippedToggle
          title="Horizontal rule"
          ariaLabel="horizontal rule"
          value="hr"
          disabled={disabled}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <HorizontalRuleIcon fontSize="small" />
        </TippedToggle>
        <TippedToggle
          title="Insert image / attachment"
          ariaLabel="insert image"
          value="image"
          disabled={disabled}
          onClick={openFileDialog}
        >
          <ImageIcon fontSize="small" />
        </TippedToggle>
        <TippedToggle
          title="Insert LaTeX"
          ariaLabel="insert latex"
          value="latex"
          disabled={disabled}
          onClick={openLatexDialog}
        >
          <FunctionsIcon fontSize="small" />
        </TippedToggle>
      </ToggleButtonGroup>
    </PanelSection>
  );
};
