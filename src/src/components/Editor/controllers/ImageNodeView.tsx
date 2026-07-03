import { Box } from "@mui/material";
import {
  NodeViewWrapper,
  useCurrentEditor,
  type NodeViewProps,
} from "@tiptap/react";
import { useThemeStore } from "../../../zustand/useThemeStore";
import { useMemo, useRef } from "react";
import { M2 } from "../../../statics";
import { useEditorSettings } from "../../../zustand/useEditorSettings";
import { useAuthStore } from "../../../zustand/useAuthStore";
import { AttachmentApi } from "../../../api/AttachmentApi";
import { AttachmentLinkBuilder } from "../../../api/utils/AttachmentLInkBuilder";
import { extractAttachmentKeyFromUrl } from "../../../api/utils/request_helpers";
import { useUser } from "../../../api/queries/useUser";

export function ImageNodeView({ node, selected, getPos }: NodeViewProps) {
  const { theme } = useThemeStore();
  const { editMode } = useEditorSettings();

  // use attachment tokens, so that public users can access images
  const { shareAttachmentTokens } = useAuthStore();

  // To grant image access to public users,
  // we need to patch the URL by appending an JWT
  // just generated for public users for this one attachment 15 minutes.
  const resolvedSrc = (src: string) => {
    const attachmentKey = extractAttachmentKeyFromUrl(src);

    if (!attachmentKey) return src;
    const jwt = shareAttachmentTokens[attachmentKey];
    if (!jwt) {
      console.warn(
        `No share-attachment JWT found for attachment key ${attachmentKey}. The image WILL not load for public users.`,
      );
      return src;
    }
    return new AttachmentLinkBuilder(new AttachmentApi())
      .setJwt(jwt)
      .getLink(attachmentKey);
  };

  const src: string = resolvedSrc(node.attrs.src ?? "");

  console.log(
    "ImageNodeView - rerender; authstore has token?",
    Object.keys(shareAttachmentTokens).length > 0,
    "has exact token: ",
    !!shareAttachmentTokens[extractAttachmentKeyFromUrl(src)],
  );

  return (
    <NodeViewWrapper
      data-drag-handle
      contentEditable={false}
      className={selected ? "selected-image" : ""}
      //style={}
    >
      <Box
        sx={{
          paddingY: M2,
          width: "fit-content",
        }}
      >
        <Box
          component={"img"}
          src={src}
          alt={src}
          sx={{
            display: "block",

            outline:
              selected && editMode
                ? `2px solid ${theme.palette.primary.main}`
                : "none",
            outlineOffset: "2px",
            transition: "outline 0.2s ease",
            borderRadius: 1,
          }}
        ></Box>
      </Box>
    </NodeViewWrapper>
  );
}
