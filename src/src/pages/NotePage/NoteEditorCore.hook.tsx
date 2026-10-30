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
import { useAuthStore } from "../../zustand/useAuthStore";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useUser } from "../../api/queries/useUser";
import { usePublicUserStore } from "../../zustand/usePublicUserStore";
import { colorFromString, randomMatchingColor } from "../../utils/blendWithContrast";
import { CustomCodeBlock } from "../../components/Editor/View/CustomCodeBlock";
import { EditorContextHighlight } from "../../components/Editor/editorContextHighlight";
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
import { getAttachmentApi } from "../../api/AttachmentApi";
import { AttachmentLinkBuilder } from "../../api/utils/AttachmentLInkBuilder";
import UploadFileBuilder from "./UploadFileBuilder";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import type { ApplicationAttachmentBody } from "./AttachmentPanelSection";
import { type LatexDialogOpenParams } from "./LatexDialogController.utils";
import type { EditorContextMenuOpener } from "../../components/RightClick/EditorRightClickMenu";
import {
  fragmentLength,
  fragmentText,
  logCollabContent,
} from "../../hooks/collabContentLog";

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
  /** Same idea for the right-click menu: EditorRightClickMenu keeps
   *  this pointed at a handler that reads the live editor state. */
  contextMenuOpenerRef: React.MutableRefObject<EditorContextMenuOpener | null>;
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
    contextMenuOpenerRef,
  } = params;

  const { theme } = useThemeStore();
  const { data: user } = useUser();
  const editMode = useEditorSettings((s) => s.editMode);
  // A share JWT in the store means we're on a public share; image reads
  // are token-authorized there, so the permission-poll isn't applicable.
  const isPublicShare = useAuthStore((s) => s.shareAccessToken !== null);

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
  // the shared public handle for both the display name and the id so
  // the live-users badge has the id to render directly. Reading it
  // from the store keeps the caret label and the topbar in sync, and
  // lets a rename from the user menu flow through to collaborators.
  const publicUserName = usePublicUserStore((s) => s.name);

  // Stable ref the editor's paste-handler calls into. Closes over
  // noteId so a note flip swaps the upload's link target.
  const handlePasteAndUpload = useCallback(
    async (file: File): Promise<string> => {
      // Must be the registered singleton: `Bootstrap` installs the
      // share-token provider on registered instances only, so a fresh
      // `new AttachmentApi()` would send no Authorization header and
      // 401 for public-share editors.
      const api = getAttachmentApi();
      const builder = new UploadFileBuilder(api, postMessage)
        .setFile(file)
        .linkToNote(noteId!);
      const key = await builder.upload();
      if (!key) {
        // `upload()` already surfaced a snackbar; abort the paste flow
        // instead of building a `?key=null` URL and polling it 50 times.
        throw new Error("Attachment upload failed");
      }
      const link = new AttachmentLinkBuilder(api).setWidth(720).getLink(key);
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
            color: user
              ? randomMatchingColor(theme)
              : colorFromString(publicUserName, theme),
            // Carried through awareness so other clients can show the
            // avatar without an API lookup (which public notes cannot do).
            avatar: user?.getAvatarUrl(),
          },
        }),
        CustomCodeBlock.configure({ lowlight, defaultLanguage: "plaintext" }),
        EditorContextHighlight,
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

        getPasteUploadExtension(
          handlePasteAndUpload,
          (message, severity) => {
            postMessage(new SnackbarUpdateImpl(message, severity));
          },
          isPublicShare,
        ),
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
        handleDOMEvents: {
          contextmenu(_view, event) {
            const opener = contextMenuOpenerRef.current;
            // No opener (mobile, or not mounted yet): leave the
            // native menu to the browser.
            if (!opener) return false;
            opener(event);
            return true;
          },
        },
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

          const api = getAttachmentApi();
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

  // Push a public viewer's renamed handle into the awareness state so
  // collaborators see the new label without the editor re-mounting.
  // Logged-in users keep their fixed Discord identity.
  useEffect(() => {
    if (!editor || user) {
      return;
    }
    editor.commands.updateUser({
      name: publicUserName,
      id: publicUserName,
      color: colorFromString(publicUserName, theme),
    });
  }, [editor, user, publicUserName, theme]);

  // Mirror the active Y.Doc into the store so setContent can write
  // directly into the XmlFragment instead of editor.commands.setContent.
  // The read -> write flip swaps `ydoc` from null to the live doc, so
  // this effect also logs the fragment state at the moment of the bind.
  useEffect(() => {
    useActiveNoteStore.getState().setYDoc(ydoc ?? null);
    logCollabContent("editor-bind", noteId, {
      hasYdoc: !!ydoc,
      hasProvider: !!provider,
      providerSynced: provider?.synced ?? null,
      wsStatus: provider?.configuration?.websocketProvider?.status ?? null,
      fragmentLen: fragmentLength(ydoc),
      fragmentHead: fragmentText(ydoc).slice(0, 200),
    });
    return () => useActiveNoteStore.getState().setYDoc(null);
  }, [noteId, ydoc, provider]);

  // Seed the editor with note content. Keyed on note?.id (not note) so
  // a fresh Tanstack Note ref does not re-seed and feed the markdown
  // round-trip feedback loop that tripped the editor watchdog.
  //
  // Only seed when there is no live session (read mode). With a
  // collab session open the Y.Doc holds the live state of the note,
  // which can be ahead of the last save. Writing the saved markdown
  // into it would reset the live doc to the last saved version every
  // time the editor mounts. The collaboration provider supplies the
  // shared Y.Doc state from the server.
  useEffect(() => {
    if (!note || !editor || editor.isDestroyed) return;
    logCollabContent("read-mode-seed", noteId, {
      hasYdoc: !!ydoc,
      noteContentLen: note.content?.length ?? 0,
      noteContentHead: (note.content ?? "").slice(0, 120),
    });
    if (ydoc) return;
    useActiveNoteStore.getState().setContent(note.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, note?.id, ydoc]);

  // Sync editMode with the editor's own editable state.
  useEffect(() => {
    editor?.setEditable(editMode);
  }, [editMode, editor]);

  return editor;
};
