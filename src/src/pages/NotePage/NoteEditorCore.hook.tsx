// ---------------------------------------------------------------------------
// useNoteEditor
// Builds the Tiptap editor and wires it to the active-note store via
// mirror effects (editor ref, Y.Doc ref, per-note update callback).
// Extracted from NoteEditorCore so per-keystroke re-render cost stays
// bounded. Outline/synced/dialog/view code lives in sibling files.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { CollaborationCaret } from "@tiptap/extension-collaboration-caret";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Youtube } from "@tiptap/extension-youtube";
import { Twitch } from "@tiptap/extension-twitch";
import { TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Highlight } from "@tiptap/extension-highlight";
import Mathematics from "@tiptap/extension-mathematics";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { CaretAnimation } from "./CaretAnimation";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { Editor } from "@tiptap/core";

import type { Note } from "../../api/models/search";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useUser } from "../../api/queries/useUser";
import { generatePublicUserName } from "../../utils/publicUserName";
import { randomMatchingColor } from "../../utils/blendWithContrast";
import { CustomCodeBlock } from "../../components/Editor/View/CustomCodeBlock";
import { handleCodeBlockTabKey } from "../../components/Editor/codeBlockTabKey";
import { lowlight } from "../../components/Editor/lowlight";
import { TableWithControls } from "../../components/Editor/TableControlls/TableControlls";
import {
  getNodeByFileType,
  getPasteUploadExtension,
  UploadAttachmentNode,
} from "../../components/Editor/ImagePasteExtension";
import { SmartTextReplacement } from "../../components/Editor/SmartTextReplacement";
import { CustomImage } from "../../components/Editor/View/CustomImage";
import { CustomLink } from "../../components/Editor/View/CustomLink";
import { CustomSvgLink } from "../../components/Editor/View/CustomSvgLink";
import { CustomHtml } from "../../components/Editor/CustomHtml";
import { CustomHardBreak } from "../../components/Editor/CustomHardBreak";
import { CustomDetails } from "../../components/Editor/CustomDetails";
import { SlashMenuStateExtension } from "../../components/Editor/SlashCommandMenu";
import { AttachmentApi } from "../../api/AttachmentApi";
import { AttachmentLinkBuilder } from "../../api/utils/AttachmentLInkBuilder";
import UploadFileBuilder from "./UploadFileBuilder";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import type { ApplicationAttachmentBody } from "./AttachmentPanelSection";
import { type LatexDialogOpenParams } from "./LatexDialogController.utils";

import "katex/dist/katex.min.css";
import "../../styles/tiptap.css";

export interface UseNoteEditorParams {
  noteId?: string;
  ydoc: Y.Doc | null;
  provider: HocuspocusProvider | null;
  note: Note | undefined;
  onNoteUpdated: (note: Note) => void;
  /** Tanstack update mutation; signature is the hook's own. */
  updateNote: (vars: {
    noteId: string;
    title: string;
    content: string;
  }) => Promise<Note>;
  /** Stable ref the math extension's onClick calls into. Updated by
   *  LatexDialogController on every render so the editor can call
   *  the opener without re-creating the editor. */
  latexOpenerRef: React.MutableRefObject<
    ((params: LatexDialogOpenParams) => void) | null
  >;
}

/** Snackbar message setter; module-level so paste handler closures stay small. */
function postMessage(message: SnackbarUpdateImpl) {
  useInfoStore.getState().setMessage(message);
}

/** Creates the Tiptap editor and wires it to the active-note store. Editor is stable across transactions. */
export const useNoteEditor = (params: UseNoteEditorParams): Editor | null => {
  const {
    noteId,
    ydoc,
    provider,
    note,
    onNoteUpdated,
    updateNote,
    latexOpenerRef,
  } = params;

  const { theme } = useThemeStore();
  const { data: user } = useUser();
  const editMode = useEditorSettings((s) => s.editMode);

  // Read-mode fallback: the Collaboration extension needs *some* Y.Doc
  // to attach to, even when there's no live collab session. The note's
  // markdown content is loaded into this empty doc by the seed effect.
  const emptyYdoc = useRef(new Y.Doc());
  const dummyProvider = useRef({
    awareness: new Awareness(new Y.Doc()),
    on: () => {},
    off: () => {},
    connect: () => {},
    disconnect: () => {},
  });
  // The ref access is intentional: a fresh per-mount Y.Doc is the
  // read-mode stand-in. ESLint flags it; the alternative (a useMemo
  // or effect) would force an editor re-mount on every dep change,
  // which is the very thing we are trying to avoid.
  // eslint-disable-next-line react-hooks/refs
  const stableYdoc = ydoc ?? emptyYdoc.current;
  // eslint-disable-next-line react-hooks/refs
  const stableProvider = provider ?? dummyProvider.current;

  // Public viewers have no Discord profile; awareness falls back to
  // a generated handle for both the display name and the id so the
  // live-users badge has the id to render directly.
  const publicUserName = generatePublicUserName();

  // Stable ref the editor's paste-handler calls into. Closes over
  // noteId so a note flip swaps the upload's link target.
  const handlePasteAndUpload = useCallback(
    async (file: File): Promise<string> => {
      const api = new AttachmentApi();
      const builder = new UploadFileBuilder(api, postMessage)
        .setFile(file)
        .linkToNote(noteId!);
      const key = await builder.upload();
      const link = new AttachmentLinkBuilder(api).setWidth(720).getLink(key!);
      return link;
    },
    [noteId],
  );

  const editor = useEditor(
    {
      // ShouldRerenderOnTransaction=false keeps this component out of
      // the editor's per-transaction re-render loop. The editor itself
      // is stable across transactions; consumers that need to react to
      // state (e.g. formatting flags, visibility) subscribe via
      // `useEditorState` directly. Without this, the inner tree below
      // re-renders on every keystroke, which is the source of the
      // `flushSync was called from inside a lifecycle method` storm.
      shouldRerenderOnTransaction: false,
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          dropcursor: {},
          undoRedo: false,
          // Replaced by CustomLink so /api/... hrefs render with the backend origin prepended.
          link: false,
          hardBreak: false,
        }),
        CustomHardBreak,
        CustomLink.configure({ openOnClick: true }),
        // Smooth caret overlay for the local user. Built on top of
        // `Decoration.widget` (the same primitive
        // CollaborationCaret uses) so the caret sits inside the
        // document tree, follows text flow, and scrolls with the
        // editor. The extension reads `useEditorSettings.editMode`
        // itself on every decoration rebuild, so flipping the
        // read/edit toggle at runtime takes effect immediately.
        CaretAnimation,
        Collaboration.configure({ document: stableYdoc }),
        CollaborationCaret.configure({
          provider: stableProvider,
          user: {
            name: user?.username ?? publicUserName,
            id: user?.id ?? publicUserName,
            color: randomMatchingColor(theme),
          },
        }),
        CustomCodeBlock.configure({ lowlight, defaultLanguage: "plaintext" }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Youtube.configure({ inline: false, width: 480, height: 320 }),
        Twitch.configure({
          inline: false,
          width: 480,
          height: 320,
          parent: window.location.hostname,
        }),
        UploadAttachmentNode,
        CustomImage,
        CustomSvgLink,
        CustomDetails,
        DetailsSummary,
        DetailsContent,
        ...CustomHtml,
        TableCell,
        TableRow,
        TableHeader,
        TableWithControls.configure({ resizable: false }),
        Highlight,
        // eslint-disable-next-line react-hooks/refs
        Mathematics.configure({
          blockOptions: {
            onClick: (node, pos) => {
              if (!editor?.isEditable) return;
              latexOpenerRef.current?.({
                latex: node.attrs.latex,
                type: "block",
                pos,
                mode: "edit",
              });
            },
          },
          inlineOptions: {
            onClick: (node, pos) => {
              if (!editor?.isEditable) return;
              latexOpenerRef.current?.({
                latex: node.attrs.latex,
                type: "inline",
                pos,
                mode: "edit",
              });
            },
          },
        }),

        getPasteUploadExtension(handlePasteAndUpload, (message, severity) => {
          postMessage(new SnackbarUpdateImpl(message, severity));
        }),
        Placeholder.configure({
          showOnlyCurrent: true,
          includeChildren: true,
          placeholder: ({ node, editor: placeholderEditor }) => {
            if (node.type.name === "detailsSummary") {
              return "Summary";
            }
            if (node.type.name !== "paragraph") return "";
            if (
              placeholderEditor.isActive("table") ||
              placeholderEditor.isActive("bulletList") ||
              placeholderEditor.isActive("orderedList") ||
              placeholderEditor.isActive("taskList") ||
              placeholderEditor.isActive("codeBlock")
            ) {
              return "";
            }
            return "Write anything or use / for commands";
          },
        }),
        SmartTextReplacement,
        SlashMenuStateExtension,
        Markdown,
      ],

      content: undefined,
      contentType: "markdown",
      editorProps: {
        handleKeyDown(view, event) {
          // Indent / outdent inside a codeBlock. Reads the selection
          // ancestry straight from `view.state` -- see the comment on
          // `codeBlockTabKey.ts` for why the previous
          // `editor?.isActive(...)` gate never fired.
          return handleCodeBlockTabKey(view, event);
        },
        handleDrop(view, event) {
          const jsonBody = event.dataTransfer?.getData(
            "application/x-application-attachment",
          );
          if (!jsonBody) {
            return false;
          }
          const attachmentBody = JSON.parse(
            jsonBody,
          ) as ApplicationAttachmentBody;
          if (!attachmentBody.key) return false;

          const coords = { left: event.clientX, top: event.clientY };
          const pos = view.posAtCoords(coords);
          if (!pos) return true;

          const api = new AttachmentApi();
          const link = new AttachmentLinkBuilder(api)
            .setWidth(720)
            .setContentType(
              attachmentBody.contentType ?? "application/octet-stream",
            )
            .getLink(attachmentBody.key);
          const node = getNodeByFileType(
            attachmentBody.contentType,
            attachmentBody.filename,
            link,
            view,
          )!;
          const transaction = view.state.tr.insert(pos.pos, node);
          view.dispatch(transaction);
          return true;
        },
      },
    },
    [noteId, ydoc],
  );

  // Wire the per-note callbacks (note id, save handler) into the store
  // exactly once per note. The editor itself is registered separately
  // so editor recreation does not tear down and re-wire note bindings.
  useEffect(() => {
    const store = useActiveNoteStore.getState();
    store.registerNote(noteId, onNoteUpdated);
    store.setUpdateNoteFn((title: string, content: string) => {
      return updateNote({ noteId: noteId!, title, content });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // Mirror the editor ref into the store. Re-runs on editor recreation
  // and clears on unmount so a stale editor never lingers.
  useEffect(() => {
    useActiveNoteStore.getState().setEditor(editor ?? null);
    return () => useActiveNoteStore.getState().setEditor(null);
  }, [editor]);

  // Mirror the active Y.Doc into the store so setContent can write
  // directly into the XmlFragment instead of editor.commands.setContent.
  useEffect(() => {
    useActiveNoteStore.getState().setYDoc(ydoc ?? null);
    return () => useActiveNoteStore.getState().setYDoc(null);
  }, [ydoc]);

  // Seed the editor with note content. Keyed on note?.id (not note) so
  // a fresh Tanstack Note ref does not re-seed and feed the markdown
  // round-trip feedback loop that tripped the editor watchdog.
  useEffect(() => {
    if (!note || !editor || editor.isDestroyed) return;
    useActiveNoteStore.getState().setContent(note.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, note?.id]);

  // Sync editMode with the editor's own editable state.
  useEffect(() => {
    editor?.setEditable(editMode);
  }, [editMode, editor]);

  return editor;
};
