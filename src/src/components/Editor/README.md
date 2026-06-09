## Editor Components (Tiptap + MUI)

This directory contains reusable building blocks for the rich-text editor used in:

- the modal editor flow in `NoteEditModal`
- the full-page note editor flow in `NotePage`

The components here are intentionally split by responsibility: editor shell, formatting menus, slash commands, table controls, and theme wrappers.

## Component Overview

### Core editor shell

- `NoteEditModal.tsx`
	- Modal-based editor implementation.
	- Sets up Tiptap extensions and markdown mode toggling (`Rich` <-> `Source`).
	- Wires in static and bubble controls (`EditorStaticMenu`, `EditorBubbleMenu`).

- `ThemedEditorBox.tsx`
	- Visual wrapper around `EditorContent`.
	- Applies theme-aware styles for table borders, inline code, and editor chrome.
	- Wraps children with `CodeBlockThemer`.

- `CodeBlockThemer.tsx`
	- Theme-aware code block styling (including `hljs-*` syntax token classes).

### Formatting controls

- `EditorStaticMenu.tsx`
	- Always-visible toolbar above editor content.
	- Includes:
		- `BoldItalicMenu`
		- `TableButtonGroup`
		- source mode toggle
		- read-only toggle

- `EditorBubbleMenu.tsx`
	- Basic contextual bubble menu.
	- Hidden while table node is active.
	- Currently renders `BoldItalicMenu`.

- `BoldItalicMenu.tsx`
	- Toggle buttons for bold, italic, strike.
	- Uses `useEditorState` to keep visual state synced with selection marks.

- `TextSelectionBubbleMenu.tsx`
	- Contextual menu for selected text.
	- Includes bold, italic, strike, inline code, highlight, and clear formatting.
	- Visibility rules:
		- editor must be editable
		- feature must be enabled
		- editor must be focused
		- selection must be non-empty and non-whitespace
	- Publishes visibility to shared store (`editorMenuStore`) so competing table hover controls can be suppressed immediately.

### Slash command controls

- `SlashCommandMenu.tsx`
	- Floating menu shown when current paragraph starts with `/`.
	- Filters and ranks commands by query score.
	- `Enter` executes top-ranked command.
	- Current command set:
		- `/table`
		- `/bullet-point`
		- `/enumerate`
		- `/heading-1`
		- `/heading-2`
		- `/heading-3`
		- `/codeblock`

### Table controls

- `TableControlls.tsx`
	- Exports `TableWithControls` (custom table extension with React node view).
	- Adds hover controls for add/remove rows and columns.
	- Suppresses table hover controls while text selection menu is active.

- `TablePinnedMenu.tsx`
	- Bubble menu for table operations when selection is inside a table.
	- Not always mounted in every editor surface, but available for table-focused workflows.

- `TableButtonGroup.tsx`
	- Static toolbar group with quick table insertion button.

## Shared state and interaction rules

- Shared Zustand store: `editorMenuStore.ts`
	- `isTextSelectionMenuOpen`
	- `setTextSelectionMenuOpen`

Why this exists:

- Prevents visual/menu collisions between text-selection formatting and table hover controls.
- Enables immediate coordination across independently mounted menu components.

## Usage patterns

### In the full-page note editor

`NotePage` mounts:

- `TextSelectionBubbleMenu`
- `SlashCommandMenu`
- `ThemedEditorBox`
- `TableWithControls` as the table extension

### In the modal editor

`NoteEditModal` mounts:

- `EditorStaticMenu`
- `EditorBubbleMenu`
- `ThemedEditorBox`

and supports markdown source editing through a source-mode `TextField`.

## Adding new slash commands

In `SlashCommandMenu.tsx`, extend the `slashCommands` array with:

- `id`: stable command identifier (also used in `/id` display)
- `label`: user-facing name
- `keywords`: search aliases
- `run(editor)`: command implementation

Guidelines:

- Clear the slash line before applying block commands (`clearSlashLine(editor)`).
- Keep `run` deterministic and side-effect free beyond editor updates.
- Prefer chainable Tiptap commands with `.focus()`.

## Troubleshooting

- Bubble menu appears too early:
	- Check `isTextSelectionMenuVisibleNow` guard logic in `TextSelectionBubbleMenu.tsx`.
	- Ensure editor focus and non-empty selection checks remain intact.

- Table controls overlap text-selection menu:
	- Verify `setTextSelectionMenuOpen` updates fire on `selectionUpdate` and `transaction`.
	- Verify `TableControlls.tsx` is reading `isTextSelectionMenuOpen` from store.

- Slash commands do not appear:
	- Selection must be collapsed.
	- Current block must be a paragraph.
	- Paragraph text must begin with `/`.
	- Editor must not be in table/list/taskList/codeBlock contexts.

## Notes

- File naming currently includes `TableControlls.tsx` (double "l"). Keep import paths consistent unless a dedicated rename refactor is performed.
- 