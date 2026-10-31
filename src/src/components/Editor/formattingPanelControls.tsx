// Context-aware tool registry for the right-rail Formatting panel.
//
// The panel is intentionally extensible: each entry below describes one
// selection context (image, table, code block, list, ...) and supplies
// the button cluster to show while that context is active. Adding a new
// context is a single object in `FORMATTING_CONTEXTS` — no changes to
// the panel itself.

import type { Editor } from "@tiptap/core";
import {
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FormatIndentIncreaseIcon from "@mui/icons-material/FormatIndentIncrease";
import FormatIndentDecreaseIcon from "@mui/icons-material/FormatIndentDecrease";
import { useEditorState } from "@tiptap/react";
import { useImageResizeStore } from "../../zustand/useImageResizeStore";
import { defaultImageResizeStrategy } from "./imageResizeStrategy";
import {
  applyImageWidth,
  deleteSelectedImage,
  getSelectedImage,
} from "./imageSelection";
import { analyseSelection } from "./bubbleMenuStrategies";
import { tableCommandsFor } from "./tableCommands";
import { iconForName } from "./editorIcons";

// Wraps a ToggleButton in a Tooltip. A disabled button fires no events,
// so MUI's Tooltip needs a span wrapper to still show its title. The
// wrapper only exists while disabled; ToggleButtonGroup sees this
// component (not the span), so selection still works.
export const TippedToggle: React.FC<{
  title: string;
  disabled?: boolean;
  selected?: boolean;
  onClick: () => void;
  value: string;
  ariaLabel: string;
  children: React.ReactNode;
}> = ({ title, disabled, selected, onClick, value, ariaLabel, children }) => {
  const button = (
    <ToggleButton
      value={value}
      selected={selected}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </ToggleButton>
  );
  return (
    <Tooltip title={title} disableInteractive>
      {disabled ? (
        <span style={{ display: "inline-flex" }}>{button}</span>
      ) : (
        button
      )}
    </Tooltip>
  );
};

export interface FormattingContextProps {
  editor: Editor;
  disabled: boolean;
}

export interface FormattingContext {
  id: string;
  /** Short label for the cluster (reserved for future section headers). */
  label: string;
  /** Higher priority wins when several contexts match. */
  priority: number;
  match: (editor: Editor) => boolean;
  Component: React.FC<FormattingContextProps>;
}

/**
 * Finds the node that encloses the current selection and deletes it.
 * Used to remove a whole list/code block rather than only its text.
 */
function deleteEnclosingNode(editor: Editor, typeName: string): void {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === typeName) {
      const from = $from.before(depth);
      editor
        .chain()
        .focus()
        .deleteRange({ from, to: from + node.nodeSize })
        .run();
      return;
    }
  }
}

function enclosingNodeText(editor: Editor, typeName: string): string {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === typeName) return node.textContent;
  }
  return "";
}

function copyToClipboard(text: string): void {
  if (!text || !navigator.clipboard?.writeText) return;
  void navigator.clipboard.writeText(text);
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

const ImageTools: React.FC<FormattingContextProps> = ({
  editor,
  disabled,
}) => {
  const locked = useImageResizeStore((state) => state.locked);
  const toggleLocked = useImageResizeStore((state) => state.toggleLocked);

  const style = useEditorState({
    editor,
    selector: (ctx) =>
      (getSelectedImage(ctx.editor)?.attrs.style as string | null) ?? null,
  });

  const currentWidth = defaultImageResizeStrategy.parse(style).width;
  const activeQuick =
    defaultImageResizeStrategy.quickSizes.find(
      (quick) =>
        currentWidth?.unit === quick.width.unit &&
        currentWidth?.value === quick.width.value,
    )?.label ?? null;

  return (
    <>
      <ToggleButtonGroup size="small" color="secondary">
        <TippedToggle
          title={locked ? "Aspect ratio locked" : "Aspect ratio unlocked"}
          ariaLabel="toggle aspect ratio lock"
          value="lock"
          selected={locked}
          disabled={disabled}
          onClick={toggleLocked}
        >
          {locked ? (
            <LockIcon fontSize="small" />
          ) : (
            <LockOpenIcon fontSize="small" />
          )}
        </TippedToggle>
        <TippedToggle
          title="Delete image"
          ariaLabel="delete image"
          value="delete"
          disabled={disabled}
          onClick={() => deleteSelectedImage(editor)}
        >
          <DeleteOutlineIcon fontSize="small" color="error" />
        </TippedToggle>
      </ToggleButtonGroup>

      <ToggleButtonGroup
        size="small"
        color="secondary"
        exclusive
        value={activeQuick}
      >
        {defaultImageResizeStrategy.quickSizes.map((quick) => (
          <TippedToggle
            key={quick.label}
            title={`Set width to ${quick.label}`}
            ariaLabel={`width ${quick.label}`}
            value={quick.label}
            disabled={disabled}
            onClick={() => applyImageWidth(editor, quick.width)}
          >
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {quick.label}
            </Typography>
          </TippedToggle>
        ))}
      </ToggleButtonGroup>
    </>
  );
};

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

const TableTools: React.FC<FormattingContextProps> = ({
  editor,
  disabled,
}) => {
  const analysis = useEditorState({
    editor,
    selector: (ctx) => analyseSelection(ctx.editor.state),
  });
  const commands = tableCommandsFor(analysis);

  // The rail is narrow; wrap the (potentially ~10) table actions into
  // rows instead of one unbreakable ToggleButtonGroup.
  const rows: Array<typeof commands> = [];
  for (let index = 0; index < commands.length; index += 4) {
    rows.push(commands.slice(index, index + 4));
  }

  return (
    <Stack spacing={1}>
      {rows.map((row) => (
        <ToggleButtonGroup
          key={row.map((command) => command.id).join(":")}
          size="small"
          color="secondary"
        >
          {row.map((command) => {
            const label = command.label(analysis);
            return (
              <TippedToggle
                key={command.id}
                title={label}
                ariaLabel={label}
                value={command.id}
                disabled={disabled}
                onClick={() => command.run(editor, analysis)}
              >
                {iconForName(command.bubbleIcon)}
              </TippedToggle>
            );
          })}
        </ToggleButtonGroup>
      ))}
    </Stack>
  );
};

// ---------------------------------------------------------------------------
// Code block
// ---------------------------------------------------------------------------

const CodeBlockTools: React.FC<FormattingContextProps> = ({
  editor,
  disabled,
}) => (
  <ToggleButtonGroup size="small" color="secondary">
    <TippedToggle
      title="Copy code"
      ariaLabel="copy code"
      value="copy-code"
      disabled={disabled}
      onClick={() => copyToClipboard(enclosingNodeText(editor, "codeBlock"))}
    >
      <ContentCopyIcon fontSize="small" />
    </TippedToggle>
    <TippedToggle
      title="Delete code block"
      ariaLabel="delete code block"
      value="delete-code"
      disabled={disabled}
      onClick={() => deleteEnclosingNode(editor, "codeBlock")}
    >
      <DeleteOutlineIcon fontSize="small" color="error" />
    </TippedToggle>
  </ToggleButtonGroup>
);

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

const ListTools: React.FC<FormattingContextProps> = ({ editor, disabled }) => {
  const listType = useEditorState({
    editor,
    selector: (ctx) => {
      const e = ctx.editor;
      if (e.isActive("taskList")) return "taskList";
      if (e.isActive("orderedList")) return "orderedList";
      return "bulletList";
    },
  });
  const itemType = listType === "taskList" ? "taskItem" : "listItem";

  return (
    <ToggleButtonGroup size="small" color="secondary">
      <TippedToggle
        title="Increase indent"
        ariaLabel="increase indent"
        value="indent"
        disabled={disabled}
        onClick={() => editor.chain().focus().sinkListItem(itemType).run()}
      >
        <FormatIndentIncreaseIcon fontSize="small" />
      </TippedToggle>
      <TippedToggle
        title="Decrease indent"
        ariaLabel="decrease indent"
        value="outdent"
        disabled={disabled}
        onClick={() => editor.chain().focus().liftListItem(itemType).run()}
      >
        <FormatIndentDecreaseIcon fontSize="small" />
      </TippedToggle>
      <TippedToggle
        title="Delete list"
        ariaLabel="delete list"
        value="delete-list"
        disabled={disabled}
        onClick={() => deleteEnclosingNode(editor, listType)}
      >
        <DeleteOutlineIcon fontSize="small" color="error" />
      </TippedToggle>
    </ToggleButtonGroup>
  );
};

// ---------------------------------------------------------------------------
// Registry (order = priority order)
// ---------------------------------------------------------------------------

// eslint-disable-next-line react-refresh/only-export-components
export const FORMATTING_CONTEXTS: readonly FormattingContext[] = [
  {
    id: "image",
    label: "Image",
    priority: 100,
    match: (editor) => getSelectedImage(editor) !== null,
    Component: ImageTools,
  },
  {
    id: "table",
    label: "Table",
    priority: 80,
    match: (editor) => editor.isActive("table"),
    Component: TableTools,
  },
  {
    id: "codeBlock",
    label: "Code block",
    priority: 70,
    match: (editor) => editor.isActive("codeBlock"),
    Component: CodeBlockTools,
  },
  {
    id: "list",
    label: "List",
    priority: 60,
    match: (editor) =>
      editor.isActive("bulletList") ||
      editor.isActive("orderedList") ||
      editor.isActive("taskList"),
    Component: ListTools,
  },
];

const PRIORITY_ORDERED_CONTEXTS = [...FORMATTING_CONTEXTS].sort(
  (a, b) => b.priority - a.priority,
);

/** Returns the most specific context that applies to the selection. */
// eslint-disable-next-line react-refresh/only-export-components
export function pickFormattingContext(
  editor: Editor,
): FormattingContext | null {
  return (
    PRIORITY_ORDERED_CONTEXTS.find((context) => context.match(editor)) ?? null
  );
}
