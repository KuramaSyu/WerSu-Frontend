// ---------------------------------------------------------------------------
// NoteEditorCore
//
// The "pure" editor: knows how to render the Tiptap editor and the
// surrounding UI, and how to talk to the Yjs document. It does NOT
// know how the collab session was sourced — the wrappers in
// `Editor.tsx` (`NoteEditor`, `PublicNoteEditor`) pick the hook and
// pass `ydoc` / `provider` as props.
//
// `ydoc` and `provider` may be `null` (e.g. before the collab hook has
// connected, or in read-only contexts that don't open a socket). In that
// case we fall back to a per-mount empty Y.Doc and a no-op provider so
// the Tiptap `Collaboration` extension still has a document to bind to.
// The read-mode useEffect then loads the note's markdown content into
// that empty document, which is what gets rendered to the user.
// ---------------------------------------------------------------------------

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Box, Input, Paper, Stack, TextField, Typography } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import type { Editor } from "@tiptap/core";
import { useEditor, EditorContent } from "@tiptap/react";
import DragHandle from "@tiptap/extension-drag-handle-react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { CollaborationCaret } from "@tiptap/extension-collaboration-caret";
import { CustomCodeBlock } from "../../components/Editor/View/CustomCodeBlock";
import { lowlight } from "../../components/Editor/lowlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Youtube } from "@tiptap/extension-youtube";
import { Twitch } from "@tiptap/extension-twitch";
import { TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Highlight } from "@tiptap/extension-highlight";
import Mathematics from "@tiptap/extension-mathematics";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import "katex/dist/katex.min.css";
import "../../styles/tiptap.css";
import { TableWithControls } from "../../components/Editor/TableControlls/TableControlls";
import { ThemedEditorBox } from "../../components/Editor/ThemedEditorBox";
import { TextSelectionBubbleMenu } from "../../components/Editor/TextSelectionBubbleMenu";
import {
  SlashCommandMenu,
  SlashMenuStateExtension,
  clearSlashCommand,
  clearSlashLine,
  type SlashCommand,
} from "../../components/Editor/SlashCommandMenu";
import { SmartTextReplacement } from "../../components/Editor/SmartTextReplacement";
import { M2, M3, NOTE_EDITOR_A4_WIDTH } from "../../statics";
import type { Note } from "../../api/models/search";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import UploadFileDialog from "./UploadSpeedDialAction";
import { AttachmentApi } from "../../api/AttachmentApi";
import UploadFileBuilder from "./UploadFileBuilder";
import {
  getNodeByFileType,
  getPasteUploadExtension,
  UploadAttachmentNode,
} from "../../components/Editor/ImagePasteExtension";
import { AttachmentPreviewModal } from "../../components/Editor/controllers/AttachmentPreviewModal";
import type { ApplicationAttachmentBody } from "./AttachmentPanelSection";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useViewConfig } from "../../zustand/useViewConfig";
import { InsertSpeedDial } from "./SpeedDial";
import { LatexDialog, type LatexDialogProps } from "./LatexDialog";
import { DialogProvider, useDialog } from "./InputDialog";
import { CustomImage } from "../../components/Editor/View/CustomImage";
import { CustomLink } from "../../components/Editor/View/CustomLink";
import { CustomSvgLink } from "../../components/Editor/View/CustomSvgLink";
import { CustomHtml } from "../../components/Editor/CustomHtml";
import { CustomHardBreak } from "../../components/Editor/CustomHardBreak";
import { CustomDetails } from "../../components/Editor/CustomDetails";
import { DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { useUser } from "../../api/queries/useUser";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { useLiveUsersStore } from "../../zustand/useLiveUsersStore";
import { useLayout } from "../../LayoutProvider";
import {
  collabStatusStore,
  type CollabStatus,
} from "../../zustand/useCollabStatusStore";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { useOutlineStore } from "../../zustand/outlineStore";
import { useEditorMenuStore } from "../../zustand/editorMenuStore";
import { uniqueSlugify } from "../../utils/slugify";
import { useUpdateNote } from "../../api/queries/useNoteQueries";
import { AttachmentLinkBuilder } from "../../api/utils/AttachmentLInkBuilder";
import { randomMatchingColor } from "../../utils/blendWithContrast";
import { generatePublicUserName } from "../../utils/publicUserName";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { imageLinkToBlock } from "./editorFormatUtils";

export interface NoteEditorProps {
  note?: Note;
  noteId?: string;
  fetchError: string | null;
  onNoteUpdated: (note: Note) => void;
  /**
   * When `true`, the editor closes the left rail on mount unless
   * the user has explicitly opened it (i.e. the panel user
   * override is set). Pages that want the left rail hidden on
   * mobile but still openable by the user pass this; pages that
   * always want the left rail visible leave it `false` / unset.
   */
  hideLeftPanel?: boolean;
}

export interface NoteEditorCoreProps extends NoteEditorProps {
  ydoc: Y.Doc | null;
  provider: HocuspocusProvider | null;
}

/**
 * Inner component that actually consumes `useDialog()`. Lives behind a
 * `DialogProvider` so the slash command can open the imperative upload
 * dialog from inside the editor tree.
 */
const NoteEditorCoreInner: React.FC<NoteEditorCoreProps> = ({
  note,
  noteId,
  fetchError: _fetchError,
  onNoteUpdated,
  ydoc,
  provider,
  hideLeftPanel,
}) => {
  const { theme } = useThemeStore();
  const { data: user } = useUser();
  const setMessage = useInfoStore((s) => s.setMessage);
  const { mutateAsync: updateNote } = useUpdateNote();
  const openDialog = useDialog();
  const { leftPanelOpen, leftPanelUserOverride, setLeftPanelOpen } =
    useLayout();

  // Honour `hideLeftPanel` on mount: when the caller asks for the
  // left rail to be hidden (e.g. mobile on the home page), close
  // it unless the user has explicitly toggled it open. `useLeftPanel`
  // already clears the override on each mount, so a re-mount gives
  // the caller a fresh chance to apply its desired default.
  useEffect(() => {
    if (!hideLeftPanel) {
      return;
    }
    if (leftPanelUserOverride) {
      return;
    }
    if (leftPanelOpen) {
      setLeftPanelOpen(false);
    }
    // leftPanelUserOverride flips on the next mount and we don't
    // want to re-run when it does; the gate above is sufficient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideLeftPanel]);

  const {
    isSaving: _isSaving,
    title,
    setTitle,
    sourceMarkdown,
    setSourceMarkdown,
    setContent,
    save,
    setUpdateNoteFn,
    setEditor,
    registerNote,
  } = useActiveNoteStore();

  // Tracks which editor surface is active and if write/read is used
  const { viewMode: editorMode, editMode } = useEditorSettings();
  // Cap the editor body to an A4-paper width by default; the action
  // row's 3-dot menu lets the viewer flip this off via `useViewConfig`.
  const a4Width = useViewConfig((s) => s.config.a4Width);
  // Mobile gets a different layout: drop the outer Paper's padding
  // and ignore `a4Width` so the editor fills the screen edge-to-edge.
  // Without this the A4 clamp leaves a strip of unused width on the
  // right, and the page is still horizontally scrollable inside that
  // strip, which feels broken on a phone.
  const { isMobile } = useBreakpoint();
  const forceFullWidth = isMobile;
  const editorWidth =
    a4Width && !forceFullWidth ? NOTE_EDITOR_A4_WIDTH : "100%";

  // Read-mode fallback: the Collaboration extension needs *some* Y.Doc
  // to attach to, even when there's no live collab session. The note's
  // markdown content is loaded into this empty doc by the useEffect
  // further down (see `setContent(note.content)`).
  const emptyYdoc = useRef(new Y.Doc());
  const dummyProvider = useRef({
    awareness: new Awareness(new Y.Doc()),
    on: () => {},
    off: () => {},
    connect: () => {},
    disconnect: () => {},
  });
  const stableYdoc = ydoc ?? emptyYdoc.current;
  const stableProvider = provider ?? dummyProvider.current;

  // dialog open state for file upload
  const [fileUploadDialogOpen, setFileUploadDialogOpen] = useState(false);

  // ref for textfield of source view
  const sourceEditorRef = useRef<HTMLInputElement | null>(null);

  const EMPTY_DIALOG = {
    open: false,
    latexCode: "",
    onClose: () => {},
    onCancel: () => {},
  };

  // i am sorry, this got quite complex.
  // what it does: the open opens the LatexDialog. All other things
  // are the dialogs inputs. These inputs (latex, inline, compressed)
  // are inserted into the onClose and onCancel handlers which get called
  // when the user confirms or cancels the dialog.
  const [latexDialogProps, setLatexDialogProps] =
    useState<LatexDialogProps>(EMPTY_DIALOG);

  /**factory for props for a default closed dialog */
  const getLatexDialogProps = useCallback(() => {
    return {
      open: false,
      latexCode: "",

      onClose: (
        latex: string,
        inline: "inline" | "block",
        compressed: boolean,
      ) => {},
      onCancel: (
        latex: string,
        inline: "inline" | "block",
        compressed: boolean,
      ) => {
        setLatexDialogProps({
          ...latexDialogProps,
          open: false,
        });
      },
    };
  }, [setLatexDialogProps, latexDialogProps]);

  /** Open the existing LaTeX dialog from a slash command and insert its
   * result through the Mathematics extension. */
  const openLatexDialogFromSlash = useCallback(
    (slashEditor: Editor, latexType: "inline" | "block") => {
      if (latexType === "inline") {
        clearSlashCommand(slashEditor);
      } else {
        clearSlashLine(slashEditor);
      }

      setLatexDialogProps({
        ...getLatexDialogProps(),
        open: true,
        initialLatexType: latexType,
        onClose: (newCalculation, selectedType, _compressed) => {
          const chain = slashEditor.chain();
          if (selectedType === "inline") {
            chain.insertInlineMath({ latex: newCalculation });
          } else {
            chain.insertBlockMath({ latex: newCalculation });
          }
          chain.focus().run();
          setLatexDialogProps(getLatexDialogProps());
        },
      });
    },
    [getLatexDialogProps],
  );

  // Watch the right-rail command bus: bumping the counter from
  // anywhere (e.g. the FormattingPanel buttons) opens the matching
  // dialog. NoteEditorCore owns the dialog state, so external
  // callers cannot set it directly - they request an open via
  // the store, and this effect translates the request into a local
  // setState call.
  const fileDialogRequest = useEditorMenuStore((s) => s.fileDialogRequest);
  const latexDialogRequest = useEditorMenuStore((s) => s.latexDialogRequest);

  useEffect(() => {
    if (fileDialogRequest > 0) {
      setFileUploadDialogOpen(true);
    }
  }, [fileDialogRequest]);

  useEffect(() => {
    if (latexDialogRequest > 0) {
      setLatexDialogProps({
        ...getLatexDialogProps(),
        open: true,
        latexCode: "",
      });
    }
  }, [latexDialogRequest, getLatexDialogProps]);

  useEffect(() => {
    setTitle(note?.title ?? "");
  }, [note?.id, note?.title]);

  useEffect(() => {
    if (note) {
      setSourceMarkdown(note.content || note.stripped_content || "");
    }
  }, [note?.id]);

  // Public (anonymous) viewers don't have a Discord profile, so the
  // awareness falls back to a friendly generated handle for both the
  // display name and the id. They share a value so the live-users
  // badge — which has no Discord lookup for them — has the id to
  // render directly.
  const publicUserName = generatePublicUserName();

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          dropcursor: {},
          undoRedo: false,
          // Replaced by `CustomLink` so `/api/...` hrefs render with the backend origin prepended.
          link: false,
          hardBreak: false,
        }),
        CustomHardBreak,
        CustomLink.configure({
          openOnClick: true,
        }),
        Collaboration.configure({
          document: stableYdoc,
        }),
        CollaborationCaret.configure({
          provider: stableProvider,
          user: {
            name: user?.username ?? publicUserName,
            id: user?.id ?? publicUserName,
            // random color
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
        Mathematics.configure({
          blockOptions: {
            onClick: (node, pos) => {
              if (!editor.isEditable) {
                return;
              }
              // open latex dialog with current latex code
              // and insert it if the user confirms the dialog
              setLatexDialogProps({
                ...getLatexDialogProps(),
                open: true,
                latexCode: node.attrs.latex,
                initialLatexType: "block",
                onClose: (newCalculation, inline, compressed) => {
                  try {
                    const chain = editor.chain().setNodeSelection(pos);

                    if (inline === "block") {
                      chain.updateBlockMath({ latex: newCalculation });
                    } else {
                      chain.deleteBlockMath();
                      chain.insertInlineMath({ latex: newCalculation });
                    }
                    chain.focus().run();
                  } catch (error) {
                    console.error("Failed to update block math", error);
                  }

                  setLatexDialogProps(getLatexDialogProps());
                },
              });
            },
          },
          inlineOptions: {
            onClick: (node, pos) => {
              if (!editor.isEditable) {
                return;
              }

              // open latex dialog with current latex code
              // and insert it if the user confirms the dialog
              setLatexDialogProps({
                ...getLatexDialogProps(),
                open: true,
                latexCode: node.attrs.latex,
                initialLatexType: "inline",
                onClose: (newCalculation, inline, compressed) => {
                  try {
                    const chain = editor.chain().setNodeSelection(pos);

                    if (inline === "inline") {
                      chain.updateInlineMath({ latex: newCalculation });
                    } else {
                      chain.deleteInlineMath();
                      chain.insertBlockMath({ latex: newCalculation });
                    }
                    chain.focus().run();
                  } catch (error) {
                    console.error("Failed to update inline math", error);
                  }
                  setLatexDialogProps(getLatexDialogProps());
                },
              });
            },
          },
        }),

        getPasteUploadExtension(handlePasteAndUpload, (message, severity) => {
          setMessage(new SnackbarUpdateImpl(message, severity));
        }),
        Placeholder.configure({
          showOnlyCurrent: true,
          includeChildren: true,
          placeholder: ({ node, editor: placeholderEditor }) => {
            // for <details> summary
            if (node.type.name === "detailsSummary") {
              return "Summary";
            }

            // Restrict placeholder to standard paragraph lines.
            if (node.type.name !== "paragraph") {
              return "";
            }

            if (
              // Avoid showing this hint in structured block contexts.
              placeholderEditor.isActive("table") ||
              placeholderEditor.isActive("bulletList") ||
              placeholderEditor.isActive("orderedList") ||
              placeholderEditor.isActive("taskList") ||
              placeholderEditor.isActive("codeBlock")
            ) {
              return "";
            }

            // Main inline guidance for slash command discoverability.
            return "Write anything or use / for commands";
          },
        }),
        // No `TableOfContents` extension here — its plugin freezes on real notes (per-transaction doc walk + textContent materialization). The outline effect below handles it post-update.
        SmartTextReplacement,
        SlashMenuStateExtension,
        Markdown,
      ],

      content: undefined, // our content needs processing and this needs the editor e.g. here not possible
      contentType: "markdown",
      editorProps: {
        handleKeyDown(view, event) {
          // do not tab out of code block, but insert spaces within the code block
          if (event.key === "Tab" && editor?.isActive("codeBlock")) {
            event.preventDefault();
            const tab = "    ";
            const { state, dispatch } = view;
            const { selection } = state;
            dispatch(state.tr.insertText(tab, selection.from, selection.to));
            return true;
          }

          return false;
        },
        handleDrop(view, event) {
          // check for a dropped attachment-chip
          const jsonBody = event.dataTransfer?.getData(
            "application/x-application-attachment",
          );
          if (!jsonBody) {
            console.log("no attachment data, let tiptap handle drop");
            return false; // let tiptap handle drop, e.g. do nothing
          }
          const attachmentBody = JSON.parse(
            jsonBody,
          ) as ApplicationAttachmentBody;

          if (!attachmentBody.key) {
            console.error("Attachment data missing key:", attachmentBody);
            return false; // let tiptap handle drop, e.g. do nothing
          }

          const coords = {
            left: event.clientX,
            top: event.clientY,
          };
          const pos = view.posAtCoords(coords);
          if (!pos) {
            console.error(
              `Failed to process the drop of attachment ${attachmentBody.filename}: could not get drop position from coordinates ${JSON.stringify(coords)}`,
            );

            return true;
          } // cancel

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
          return true; // handled
        },
      },
    },
    [noteId, ydoc], // recreate editor when noteId changes to reconnect to a correct Yjs document
  );

  // register editor to useActiveNoteStore for global access and cleanup on unmount
  useEffect(() => {
    console.log("Rebuild Editor Zustand");
    registerNote(noteId, onNoteUpdated);
    setEditor(editor ?? null);
    setUpdateNoteFn((title: string, content: string) => {
      return updateNote({ noteId: noteId!, title, content });
    });

    return () => useActiveNoteStore.getState().setEditor(null);
  }, [editor]);

  // Mirror the editor's live outline into `useOutlineStore` on every
  // `editor.on("update")` (post-transaction, off the edit hot path).
  // Each heading gets a stable kebab slug (`id`) used as the URL
  // section param AND stamped onto the DOM node so
  // `document.getElementById` lookups work for click-to-scroll and
  // the `?section=` deep link.
  useEffect(() => {
    if (!editor) return;
    const push = () => {
      const doc = editor.state.doc;
      const headings: {
        level: number;
        textContent: string;
        dom: HTMLElement;
      }[] = [];
      doc.descendants((node, pos) => {
        if (node.type.name !== "heading") return;
        // Materialize textContent once — getter is O(content_length).
        const textContent = node.textContent;
        if (textContent.length === 0) return;
        const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
        if (!dom) return;
        headings.push({
          level: node.attrs.level ?? 1,
          textContent,
          dom,
        });
      });

      if (headings.length === 0) {
        useOutlineStore.getState().clear();
        return;
      }

      const slugs = uniqueSlugify(headings.map((h) => h.textContent));
      // Stamp the slug id onto each heading's DOM node (post-update, off the hot path).
      for (let i = 0; i < headings.length; i++) {
        const dom = headings[i].dom;
        if (dom.id !== slugs[i]) {
          dom.id = slugs[i];
        }
      }
      const items = headings.map((heading, index) => ({
        id: slugs[index],
        level: heading.level,
        textContent: heading.textContent,
      }));
      useOutlineStore.getState().setItems(items);
    };
    editor.on("update", push);
    push(); // seed
    return () => {
      editor.off("update", push);
      useOutlineStore.getState().clear();
    };
  }, [editor]);

  // set content when node id or editor changes. dont set on mode change
  useEffect(() => {
    if (!editMode && note && editor && !editor.isDestroyed) {
      setContent(note.content);
    }
  }, [editor, note]);

  // sync read <--> write: editMode is a zustand value. here we sync it with the editor's own state.
  useEffect(() => {
    editor?.setEditable(editMode);
  }, [editMode, editor]);

  // if editmode: update live users from provider to zustand store
  useEffect(() => {
    if (!provider?.awareness || !noteId || !editMode) {
      return;
    }
    const awareness = provider.awareness;

    const updateUsers = () => {
      if (!awareness || !noteId) return;
      var users = [];
      for (const state of awareness.getStates().values()) {
        if (state.user) {
          users.push({
            userId: state.user.id,
            color: state.user.color,
          });
        }
      }
      useLiveUsersStore.getState().setUsers(noteId, users);
      console.log("Updated live users from awareness states:", users);
    };

    awareness!.on("change", updateUsers);
    updateUsers();

    return () => {
      awareness!.off("change", updateUsers);
      useLiveUsersStore.getState().clearUsers(noteId);
    };
  }, [noteId, provider, editMode]);

  // Mirror the provider's connection state into a zustand store so the
  // toolbar badge can render without prop-drilling the provider instance.
  useEffect(() => {
    if (!noteId || !editMode) {
      if (noteId) collabStatusStore.getState().setStatus(noteId, "idle");
      return;
    }
    if (!provider) return; // hook is waiting on the JWT — leave its diagnostic alone

    const setStatus = (status: CollabStatus, message?: string) =>
      collabStatusStore.getState().setStatus(noteId, status, message);

    const onStatus = (event: { status: string }) => {
      switch (event.status) {
        case "connecting":
          setStatus(
            "connecting",
            "Opening WebSocket to the collaboration server…",
          );
          break;
        case "connected":
          setStatus("connected");
          break;
        case "disconnected":
          setStatus(
            "disconnected",
            "WebSocket closed. The provider will retry automatically.",
          );
          break;
      }
    };
    const onAuthenticated = () => setStatus("connected");
    const onAuthenticationFailed = (event?: { reason?: string }) =>
      collabStatusStore
        .getState()
        .setAuthFailed(noteId, event?.reason ?? "unknown reason");

    provider.on("status", onStatus);
    provider.on("authenticated", onAuthenticated);
    provider.on("authenticationFailed", onAuthenticationFailed);

    // Seed the status from the current provider state — needed because we
    // may subscribe *after* the socket has already opened. The actual
    // status lives on the inner `HocuspocusProviderWebsocket` (the
    // `HocuspocusProvider` itself has no `status` field), so reach
    // through `provider.configuration.websocketProvider` to read it.
    const wsStatus = provider.configuration.websocketProvider.status;
    if (wsStatus === "connected") setStatus("connected");
    else if (wsStatus === "connecting") setStatus("connecting");
    else setStatus("disconnected");

    return () => {
      provider.off("status", onStatus);
      provider.off("authenticated", onAuthenticated);
      provider.off("authenticationFailed", onAuthenticationFailed);
    };
  }, [noteId, editMode, provider]);

  // load ydoc and collaboration content into editor if edit mode
  useEffect(() => {
    if (!editor || !ydoc || !provider) {
      return;
    }

    if (!editMode) {
      console.log("read mode - disconnect from collaboration provider");
      provider.disconnect();
      return;
    }

    // call when hocuspocus returned the note state
    const onSynced = () => {
      const isEmpty = ydoc!.getXmlFragment("default").length === 0;

      // if ydoc is not empty, then use this ydoc instead
      if (!isEmpty) return;

      console.log(
        "No draft on websocket, loading draft from markdown (note content)",
      );

      setContent(note!.content);
    };

    provider.on("synced", onSynced);

    return () => {
      provider.off("synced", onSynced);
    };
    // `editMode` is required here: without it, flipping from write to
    // read (or back) doesn't trigger the `provider.disconnect()` path
    // above, so the socket stays open across mode toggles and the
    // server-side `messageReconnectTimeout` closes it ~30 s later,
    // causing the badge to flap to "Offline" on the second write.
  }, [editor, note?.id, provider, editMode]);

  // Uploads file from clipboard and inserts into editor
  async function handlePasteAndUpload(file: File): Promise<string> {
    const api = new AttachmentApi();
    const builder = new UploadFileBuilder(api, postMessage)
      .setFile(file)
      .linkToNote(noteId!);
    const key = await builder.upload();
    const link = new AttachmentLinkBuilder(api).setWidth(720).getLink(key!);
    return link;
  }

  /**
   * inserts a string at the current cursor position of the editor,
   * where it doesn't matter if the source or rich editor is used
   * @param imageLink the string to insert, usually used to insert image links
   */
  const insertAtCurrentPosition = (imageLink: string) => {
    const text = imageLinkToBlock(imageLink, editorMode);
    switch (editorMode) {
      case "rich":
        editor.chain().focus().insertContent(text).run();
        break;
      case "source": {
        const textarea = sourceEditorRef.current;
        if (!textarea) {
          return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        // reconstruct text to: text before selection + new text + text after selection
        const newValue =
          sourceMarkdown.substring(0, start ?? undefined) +
          text +
          (end ? sourceMarkdown.substring(end) : "");
        setSourceMarkdown(newValue);
      }
    }
  };

  /**
   * Slash command that pops the shared `InputDialog` in file-upload mode
   * to upload images/attachments
   */
  const imageUploadCommand: SlashCommand = {
    id: "image",
    label: "Image / Attachment",
    keywords: ["image", "upload", "attachment", "picture", "file", "media"],
    run: async (slashEditor) => {
      // remove the "/image..." line so the menu closes immediately
      clearSlashLine(slashEditor);

      // open the shared prompt dialog in file-upload mode
      const result = await openDialog({
        title: "Upload Image / Attachment",
        mode: "file",
        accept: "image/*",
        dropText: "Drag an image here",
        dropHint: "or click to browse",
        confirmLabel: "Upload",
      });

      if (!(result instanceof File)) {
        return; // user cancelled
      }

      // route through the existing paste/drop pipeline so we get
      // the placeholder + permission-wait behavior for free.
      if (editorMode === "rich" && editor) {
        editor.chain().focus().uploadAttachment(result).run();
      } else {
        // source mode — fall back to the builder so the attachment is
        // also linked to the note, and the markdown `![image](url)` is
        // inserted at the caret.
        const api = new AttachmentApi();
        await new UploadFileBuilder(api, postMessage)
          .setFile(result)
          .linkToNote(noteId!)
          .insertIntoEditor(insertAtCurrentPosition)
          .upload();
      }
    },
  };

  const latexInlineCommand: SlashCommand = {
    id: "latex-inline",
    label: "LaTeX inline",
    keywords: ["latex", "inline", "math", "formula", "equation"],
    getCommandName: () => "/latex inline",
    run: (slashEditor) => openLatexDialogFromSlash(slashEditor, "inline"),
  };

  const latexBlockCommand: SlashCommand = {
    id: "latex-block",
    label: "LaTeX block",
    keywords: ["latex", "block", "display", "math", "formula", "equation"],
    getCommandName: () => "/latex block",
    run: (slashEditor) => openLatexDialogFromSlash(slashEditor, "block"),
  };

  return (
    <>
      <Paper
        // The AppShell wrapper already provides the paper + elevation-1
        // card surface for the page; the note editor sits on top of it
        // with elevation 0 so it doesn't double-card. (The previous
        // `NOTE_EDITOR_ELEVATION = 6` made the editor look like a
        // floating dialog rather than the page's main content.)
        elevation={1}
        sx={{
          backgroundColor: "transparent",
          borderRadius: 2,
          // On mobile, the outer Paper has no padding so the editor
          // fills the screen. The AppShell's `p: M2` and mobile bottom
          // safe-area padding still apply on the scroll container that
          // wraps this Paper.
          px: forceFullWidth ? 0 : M3,
          my: forceFullWidth ? 0 : M2,

          mx: "auto",
          transition: (t) =>
            t.transitions.create("width", {
              duration: t.transitions.duration.complex,
            }),
          width:
            a4Width && !forceFullWidth
              ? `calc(${NOTE_EDITOR_A4_WIDTH} + 1rem)`
              : "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            height: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: M3,
          }}
          onClick={(event) => {
            // only focus editor, if the paper itself was clicked. not a child within it
            if (event.target !== event.currentTarget) {
              return;
            }
            editor.commands.focus("end");
          }}
        >
          {/* Main content heading  with title and save button*/}
          <Stack
            direction="row"
            sx={{
              alignItems: "center",
              alignContent: "flex-start",
              width: "100%",
            }}
            spacing={M3}
          >
            <Box
              sx={{
                // The wrapper constrains the Input to the available
                // space in the title row. Without `minWidth: 0`, a
                // flex child defaults to its content's intrinsic
                // size, which means a long title would grow the row
                // and push the outer Paper wider. `overflow: hidden`
                // clips the native input's caret so the input itself
                // scrolls horizontally instead of expanding.
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <Input
                fullWidth
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Note title"
                disableUnderline
                sx={{
                  fontSize: theme.typography.h3,
                  // On mobile the outer paper has no padding so the
                  // title hugs the left edge; on larger viewports the
                  // `pr` keeps the cursor off the Paper's right edge.
                  pr: forceFullWidth ? 0 : M2,
                }}
              />
            </Box>
          </Stack>

          {/* Rich Editor */}
          {editor && editorMode === "rich" && (
            <Box
              sx={{
                width: editorWidth,
                mx: "auto",
                transition: (t) =>
                  t.transitions.create("width", {
                    duration: t.transitions.duration.complex,
                  }),
              }}
            >
              <TextSelectionBubbleMenu editor={editor} enabled={editMode} />
              <SlashCommandMenu
                editor={editor}
                enabled={editMode}
                extraCommands={[
                  imageUploadCommand,
                  latexInlineCommand,
                  latexBlockCommand,
                ]}
              />

              <Box className="editor-drag-region">
                {/* hide handlers when editor is not editable */}
                <DragHandle
                  editor={editor}
                  className={`note-block-drag-handle ${editMode ? "" : "note-block-drag-handle--hidden"} `}
                  nested={false}
                >
                  <DragIndicatorIcon fontSize="small" />
                </DragHandle>
                <ThemedEditorBox editor={editor}>
                  <EditorContent editor={editor} className="tiptap" />
                </ThemedEditorBox>
              </Box>
            </Box>
          )}

          {/* Source Editor — same A4 wrapper as the rich surface so the
            source pane lines up with the rendered preview width. */}
          {editorMode === "source" && (
            <Box
              sx={{
                width: editorWidth,
                mx: "auto",
                transition: (t) =>
                  t.transitions.create("width", {
                    duration: t.transitions.duration.complex,
                  }),
              }}
            >
              <TextField
                value={sourceMarkdown}
                ref={sourceEditorRef}
                onChange={(event) => setSourceMarkdown(event.target.value)}
                multiline
                minRows={16}
                placeholder="Markdown source"
                fullWidth
                sx={{
                  fontFamily: "monospace",
                  "& .MuiInputBase-input": { fontFamily: "monospace" },
                }}
              />
            </Box>
          )}

          {!editor && (
            <Typography color="textSecondary">Loading editor...</Typography>
          )}
        </Box>
      </Paper>

      {/* Floating editor actions */}
      <InsertSpeedDial
        editor={editor}
        setSourceMarkdown={setSourceMarkdown}
        sourceMarkdown={sourceMarkdown}
      />

      {/* dialog which opens on file upload click */}
      <UploadFileDialog
        noteId={noteId!}
        directoryId={note?.get_dir()!}
        insertAtCurrentPosition={insertAtCurrentPosition}
        dialogOpen={fileUploadDialogOpen}
        setDialogOpen={setFileUploadDialogOpen}
        onUploadSuccess={(_) => save()}
        editor={editor}
      />
      <LatexDialog
        open={latexDialogProps.open}
        latexCode={latexDialogProps.latexCode}
        onClose={latexDialogProps.onClose}
        onCancel={latexDialogProps.onCancel}
        setOpen={(open) => setLatexDialogProps({ ...latexDialogProps, open })}
        initialLatexType={latexDialogProps.initialLatexType}
      />
      <AttachmentPreviewModal />
    </>
  );
};

/**
 * Public entry point — wraps `NoteEditorCoreInner` in a `DialogProvider`
 * so any descendant can call `useDialog()` to pop the shared input/upload
 * dialog. Keeping the provider local (rather than at the App root) means
 * the editor surface remains the single owner of the dialog lifecycle.
 */
export const NoteEditorCore: React.FC<NoteEditorCoreProps> = (props) => {
  return (
    <DialogProvider>
      <NoteEditorCoreInner {...props} />
    </DialogProvider>
  );
};

/**
 * when inserting an image, we need to check if the tiptap editor or source mode is used. The tiptap editor
 * gets an HTML img block, where as the source editor gets the markdown image link.
 *
 * `imageLinkToBlock` and `markdownToProsemirror` are defined in
 * `./editorFormatUtils.ts` and imported at the top of this file
 * (so the component body can call them). They are also re-exported
 * from `./Editor.tsx` for backwards-compat with consumers that
 * imported them from the old barrel.
 */
