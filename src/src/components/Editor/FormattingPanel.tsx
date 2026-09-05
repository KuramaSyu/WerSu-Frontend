// Formatting panel for the right rail of the note page.
// Reads the live editor from useActiveNoteStore and renders the common
// formatting buttons as small clusters. Re-renders only when the
// selected flags flip via useEditorState.

import {
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
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

// Wraps a ToggleButton in a Tooltip. Disabled ToggleButtons don't fire
// pointer events in MUI, so the Tooltip needs `disableInteractive` to
// remain dismissable when the button is disabled.
const TippedToggle: React.FC<{
  title: string;
  disabled?: boolean;
  selected?: boolean;
  onClick: () => void;
  value: string;
  ariaLabel: string;
  children: React.ReactNode;
}> = ({ title, disabled, selected, onClick, value, ariaLabel, children }) => (
  <Tooltip title={title} disableInteractive>
    <ToggleButton
      value={value}
      selected={selected}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </ToggleButton>
  </Tooltip>
);

export const FormattingPanel: React.FC = () => {
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

  return (
    <PanelSection title="Formatting" collapsible defaultExpanded spacing={1}>
      <ToggleButtonGroup size="small" color="secondary">
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
        color="secondary"
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

      <ToggleButtonGroup size="small" color="secondary">
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

      <ToggleButtonGroup size="small" color="secondary">
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
