import { Extension, mergeAttributes } from "@tiptap/core";
import { AttachmentApi } from "../../api/AttachmentApi";
import UploadFileBuilder from "../../pages/NotePage/UploadFileBuilder";
import { Plugin } from "@tiptap/pm/state";
import { string } from "zod";
import { progress } from "framer-motion";
import { Node as ProseMirrorNode } from "prosemirror-model";
import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { AssignmentReturnSharp } from "@mui/icons-material";

/**
 * factory function to create a paste upload extension for tiptap editor with dynamic upload function
 * @param onUploadHook lambda function which takes in the file and returns the link of the uploaded component
 */
export function getPasteUploadExtension(
  onUploadHook: (file: File) => Promise<string>,
  setMessage: (message: string, severity: "error" | "warning" | "info") => void,
): Extension {
  /**
   * helper function to find the placeholder node in the document
   */
  function findNodeById(
    doc: ProseMirrorNode,
    id: string,
  ): { node: ProseMirrorNode | null; pos: number | null } | null {
    let result: { node: ProseMirrorNode | null; pos: number | null } | null =
      null;
    doc.descendants((node, pos) => {
      if (node.attrs.id === id) {
        result = { node, pos };
        return false; // stop iteration
      }
    });
    return result;
  }

  const PateUploadExtension = Extension.create({
    name: "pasteUpload",

    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            handlePaste: (view, event) => {
              event.preventDefault();
              const files = Array.from(event.clipboardData?.files || []);
              if (files.length === 0) {
                return false; // no files, let other handlers process the paste
              }

              event.preventDefault(); // prevent default paste behavior

              files.forEach(async (file) => {
                const uploadID = crypto.randomUUID(); // generate UUID to later find the placeholder node to replace it

                // insert placeholder while uploading
                const placeHolder =
                  view.state.schema.nodes.uploadAttachment.create({
                    id: uploadID,
                    fileName: file.name,
                  });
                view.dispatch(view.state.tr.replaceSelectionWith(placeHolder));

                const url = await onUploadHook(file);

                // make request to url and wait until no 403 is returned. if any other
                // error code than 403 is returned, raise this error. this is just for waiting permission insert
                const response = await waitForImagePermission(url).catch(
                  (error) => {
                    console.error(
                      "Error while waiting for image permission:",
                      error,
                    );
                    setMessage("Failed to upload image.", "error");
                  },
                );
                setMessage("Pasted image", "info");

                // create actual node with image
                const imageNode = view.state.schema.nodes.image.create({
                  src: url,
                });

                // replace the placeholder
                const placeholderNode = findNodeById(view.state.doc, uploadID);
                if (!placeholderNode) {
                  console.error("Placeholder node not found");
                  return;
                }

                // replace placeholder with image node
                const tr = view.state.tr.replaceWith(
                  placeholderNode.pos!,
                  placeholderNode.pos! + placeholderNode.node!.nodeSize,
                  imageNode,
                );
                view.dispatch(tr);
                return true; // indicate that the paste event was handled
              });
              return true; // indicate that the paste event was handled
            },
          },
        }),
      ];
    },
  });
  return PateUploadExtension;
}

/**
 * Poll url as long as it returns 403 or 401 until it's accessible (200).
 * Used for checking image permissions, since they take some seconds to be effective
 * TODO: implement HEAD in backend, since Response is not used
 * @param url
 * @returns
 */
async function waitForImagePermission(url: string): Promise<Response | null> {
  // dont wait static time. 833, 714, 625, 555, 500, 454, 416, 384, 357, 333, 312, 294, 277, 263, 250, 238, 227, 217, 208,
  // -- carefully crafted
  const getWaitSeconds = (attempt: number) =>
    Math.max(1000 / (1 + attempt - attempt * 0.8), 500);

  const maxLoops = 50;
  for (let i = 1; i <= maxLoops; i++) {
    console.log(
      `Checking image permission, attempt ${i}/${maxLoops}, wait ${getWaitSeconds(i)}ms before try...`,
    );
    await new Promise((resolve) => setTimeout(resolve, getWaitSeconds(i))); // wait before retrying

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
    });

    if (response.status === 200) {
      return response;
    } else if (!(response.status === 403 || response.status === 401)) {
      throw new Error(
        `Failed while waiting for image: ${response.statusText}; code: ${response.status}`,
      );
    }
  }
  return null;
}

function UploadAttachmentView() {
  console.log("render upload placeholder");
  return (
    <NodeViewWrapper as="div">{"<!-- uploading image... -->"}</NodeViewWrapper>
  );
}

/**
 * custom node used as placeholder while the actual image is downloading/uploading
 */
export const UploadAttachmentNode = Node.create({
  name: "uploadAttachment",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      id: {},
      fileName: {},
      progress: { default: 0 },
      error: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "upload-attachment" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["upload-attachment", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(UploadAttachmentView);
  },
});
