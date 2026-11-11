// Context-aware tool registry for the right-rail Formatting panel.
//
// The panel is intentionally extensible: each entry below describes one
// selection context (image, table, code block, list, ...) and supplies
// the button cluster to show while that context is active. Adding a new
// context is a single object in `FORMATTING_CONTEXTS` — no changes to
// the panel itself.

import type { Editor } from "@tiptap/core";
import type { SxProps, Theme } from "@mui/material";
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
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import CallMergeIcon from "@mui/icons-material/CallMerge";
import { useEditorState } from "@tiptap/react";
import { useEffect } from "react";
import { useImageResizeStore } from "../../zustand/useImageResizeStore";
import { defaultImageResizeStrategy } from "./imageResizeStrategy";
import {
  applyImageWidth,
  deleteSelectedImage,
  getSelectedImage,
} from "./imageSelection";
import { analyseSelection, analyseTableAtPos } from "./BubbleMenus/bubbleMenuStrategies";
import { tableCommandsFor } from "./tableCommands";
import { iconForName } from "./editorIcons";
import {
  canIndentBlockIntoList,
  canOutdentBlockFromList,
  indentBlockIntoList,
  outdentBlockFromList,
  selectionListLevel,
} from "./blockListOperations";
import {
  getListElementMergePreview,
  getListElementMergeState,
  getListElementMoveInfo,
  mergeListItem,
  moveListElement,
  type ListElementMoveInfo,
} from "./listElementOperations";
import {
  clearListMergePreview,
  showListMergePreview,
} from "./editorListMergePreview";

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
  sx?: SxProps<Theme>;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
}> = ({
  title,
  disabled,
  selected,
  onClick,
  value,
  ariaLabel,
  sx,
  onMouseEnter,
  onMouseLeave,
  children,
}) => {
  const button = (
    <ToggleButton
      value={value}
      selected={selected}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      sx={sx}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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

/** Level-aware title for a move: within a level, or lifting to one above. */
function moveTitle(
  direction: "up" | "down",
  info: ListElementMoveInfo,
): string {
  const crosses =
    direction === "up" ? info.upCrossesLevel : info.downCrossesLevel;
  return crosses
    ? `Move ${direction} to level ${info.level - 1}`
    : `Move ${direction} within level ${info.level}`;
}

// Move-up / move-down toggles for an element inside a list. Rendered as
// plain children so they live in the same ToggleButtonGroup as the rest
// of a context's actions.
const MoveUpToggle: React.FC<{
  editor: Editor;
  disabled: boolean;
  info: ListElementMoveInfo;
}> = ({ editor, disabled, info }) => (
  <TippedToggle
    title={moveTitle("up", info)}
    ariaLabel={moveTitle("up", info)}
    value="move-up"
    disabled={disabled || !info.canMoveUp}
    onClick={() => moveListElement(editor, -1)}
  >
    <ArrowUpwardIcon fontSize="small" />
  </TippedToggle>
);

const MoveDownToggle: React.FC<{
  editor: Editor;
  disabled: boolean;
  info: ListElementMoveInfo;
}> = ({ editor, disabled, info }) => (
  <TippedToggle
    title={moveTitle("down", info)}
    ariaLabel={moveTitle("down", info)}
    value="move-down"
    disabled={disabled || !info.canMoveDown}
    onClick={() => moveListElement(editor, 1)}
  >
    <ArrowDownwardIcon fontSize="small" />
  </TippedToggle>
);

const IMAGE_NAMES: ReadonlySet<string> = new Set(["image"]);
const CODE_BLOCK_NAMES: ReadonlySet<string> = new Set(["codeBlock"]);
const BLOCKQUOTE_NAMES: ReadonlySet<string> = new Set(["blockquote"]);

/**
 * Fold a block into the list above it / pull it back out, labelled by the
 * list level it moves between. Shared by code blocks, images and quotes.
 */
const BlockListToggles: React.FC<{
  editor: Editor;
  disabled: boolean;
  names: ReadonlySet<string>;
  /** Human label, e.g. "code block". */
  label: string;
}> = ({ editor, disabled, names, label }) => {
  const canIndent = useEditorState({
    editor,
    selector: (ctx) => canIndentBlockIntoList(ctx.editor.state, names),
  });
  const canOutdent = useEditorState({
    editor,
    selector: (ctx) => canOutdentBlockFromList(ctx.editor.state, names),
  });
  const level = useEditorState({
    editor,
    selector: (ctx) => selectionListLevel(ctx.editor.state),
  });

  return (
    <>
      {canIndent && (
        <TippedToggle
          title={
            level === 0
              ? `Indent ${label} into list`
              : `Move ${label} from level ${level} to level ${level + 1}`
          }
          ariaLabel={
            level === 0
              ? `indent ${label} into list`
              : `move ${label} from level ${level} to level ${level + 1}`
          }
          value="move-into-list"
          disabled={disabled}
          onClick={() => indentBlockIntoList(editor, names)}
        >
          <FormatIndentIncreaseIcon fontSize="small" color="primary" />
        </TippedToggle>
      )}
      {canOutdent && (
        <TippedToggle
          title={
            level <= 1
              ? `Split ${label} out of list`
              : `Move ${label} from level ${level} to level ${level - 1}`
          }
          ariaLabel={
            level <= 1
              ? `split ${label} out of list`
              : `move ${label} from level ${level} to level ${level - 1}`
          }
          value="move-out-of-list"
          disabled={disabled}
          onClick={() => outdentBlockFromList(editor, names)}
        >
          <FormatIndentDecreaseIcon fontSize="small" color="primary" />
        </TippedToggle>
      )}
    </>
  );
};

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

// add-* tints primary, delete-* tints error, otherwise neutral. The
// rail only ever uses the primary accent; delete keeps its error tint.
function commandPaletteKey(id: string): "primary" | "error" | null {
  if (id.startsWith("add-")) return "primary";
  if (id.startsWith("delete-")) return "error";
  return null;
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
  // Move controls are offered only when the selected image sits inside a
  // list item; the level lets the tooltip read "within level 2".
  const moveInfo = useEditorState({
    editor,
    selector: (ctx) => getListElementMoveInfo(ctx.editor.state),
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
      <ToggleButtonGroup size="small" color="primary">
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
        {moveInfo && (
          <MoveUpToggle editor={editor} disabled={disabled} info={moveInfo} />
        )}
        {moveInfo && (
          <MoveDownToggle editor={editor} disabled={disabled} info={moveInfo} />
        )}
        <BlockListToggles
          editor={editor}
          disabled={disabled}
          names={IMAGE_NAMES}
          label="image"
        />
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
        color="primary"
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
    selector: (ctx) => {
      const state = ctx.editor.state;
      const base = analyseSelection(state);
      // A collapsed caret inside a cell is reported as "empty" by
      // analyseSelection. The rail should still offer table actions
      // whenever the caret sits in a table, so resolve the cell at the
      // caret position in that case.
      if (base.kind === "empty") {
        return analyseTableAtPos(state, state.selection.from);
      }
      return base;
    },
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
          color="primary"
        >
          {row.map((command) => {
            const label = command.label(analysis);
            const paletteKey = commandPaletteKey(command.id);
            return (
              <TippedToggle
                key={command.id}
                title={label}
                ariaLabel={label}
                value={command.id}
                disabled={disabled}
                onClick={() => command.run(editor, analysis)}
                sx={paletteKey ? { color: `${paletteKey}.main` } : undefined}
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
}) => {
  // Reorder controls, but only while the block lives inside a list item.
  const moveInfo = useEditorState({
    editor,
    selector: (ctx) => getListElementMoveInfo(ctx.editor.state),
  });

  return (
    <ToggleButtonGroup size="small" color="primary">
      {moveInfo && (
        <MoveUpToggle editor={editor} disabled={disabled} info={moveInfo} />
      )}
      {moveInfo && (
        <MoveDownToggle editor={editor} disabled={disabled} info={moveInfo} />
      )}
      <BlockListToggles
        editor={editor}
        disabled={disabled}
        names={CODE_BLOCK_NAMES}
        label="code block"
      />
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
};

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
  const moveInfo = useEditorState({
    editor,
    selector: (ctx) => getListElementMoveInfo(ctx.editor.state),
  });
  const mergeState = useEditorState({
    editor,
    selector: (ctx) => getListElementMergeState(ctx.editor.state),
  });

  // Drop any lingering preview if the panel leaves the list context
  // while the pointer still rests on the merge button.
  useEffect(() => () => clearListMergePreview(editor), [editor]);

  const previewMerge = () => {
    const preview = getListElementMergePreview(editor.state);
    if (preview) showListMergePreview(editor, preview);
  };

  return (
    <ToggleButtonGroup size="small" color="primary">
      {moveInfo && (
        <MoveUpToggle editor={editor} disabled={disabled} info={moveInfo} />
      )}
      {moveInfo && (
        <MoveDownToggle editor={editor} disabled={disabled} info={moveInfo} />
      )}
      {mergeState && (
        <TippedToggle
          title={
            mergeState.direction === "down"
              ? "Merge with next bullet"
              : "Merge with previous bullet"
          }
          ariaLabel="merge with adjacent bullet"
          value="merge"
          disabled={disabled || !mergeState.canMerge}
          onClick={() => mergeListItem(editor, mergeState.direction)}
          onMouseEnter={previewMerge}
          onMouseLeave={() => clearListMergePreview(editor)}
        >
          <CallMergeIcon fontSize="small" />
        </TippedToggle>
      )}
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
// Blockquote
// ---------------------------------------------------------------------------

const BlockquoteTools: React.FC<FormattingContextProps> = ({
  editor,
  disabled,
}) => {
  const moveInfo = useEditorState({
    editor,
    selector: (ctx) => getListElementMoveInfo(ctx.editor.state),
  });

  return (
    <ToggleButtonGroup size="small" color="primary">
      {moveInfo && (
        <MoveUpToggle editor={editor} disabled={disabled} info={moveInfo} />
      )}
      {moveInfo && (
        <MoveDownToggle editor={editor} disabled={disabled} info={moveInfo} />
      )}
      <BlockListToggles
        editor={editor}
        disabled={disabled}
        names={BLOCKQUOTE_NAMES}
        label="quote"
      />
      <TippedToggle
        title="Remove quote"
        ariaLabel="remove blockquote"
        value="delete-quote"
        disabled={disabled}
        onClick={() => deleteEnclosingNode(editor, "blockquote")}
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
  {
    id: "blockquote",
    label: "Quote",
    priority: 55,
    match: (editor) => editor.isActive("blockquote"),
    Component: BlockquoteTools,
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
