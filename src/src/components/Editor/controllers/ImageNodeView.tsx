import { Box } from "@mui/material";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useThemeStore } from "../../../zustand/useThemeStore";
import { M2 } from "../../../statics";
import { useEditorSettings } from "../../../zustand/useEditorSettings";
import { useAuthStore } from "../../../zustand/useAuthStore";
import { useAttachmentPreviewStore } from "../../../zustand/useAttachmentPreviewStore";
import { AttachmentApi } from "../../../api/AttachmentApi";
import { AttachmentLinkBuilder } from "../../../api/utils/AttachmentLInkBuilder";
import { extractAttachmentKeyFromUrl } from "../../../api/utils/request_helpers";
import { prepareBackendLink } from "../../../utils/prepareBackendLink";

// Parse a CSS declaration string like "width: 200px; height: 100px" into
// an object MUI's `sx` understands. Splits on `;` and `:` and trims.
function parseInlineStyle(style: string): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const decl of style.split(";")) {
    const colon = decl.indexOf(":");
    if (colon === -1) continue;
    const key = decl.slice(0, colon).trim();
    const value = decl.slice(colon + 1).trim();
    if (key && value) {
      // MUI sx requires camelCase for hyphenated CSS props
      const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      out[camel] = value;
    }
  }
  return out;
}

export function ImageNodeView({ node, selected, getPos }: NodeViewProps) {
  const { theme } = useThemeStore();
  const { editMode } = useEditorSettings();
  const openPreview = useAttachmentPreviewStore((s) => s.open);
  const { shareAttachmentTokens } = useAuthStore();

  // Append the share JWT so public users can load backend images; warn when the token is missing.
  const resolvedSrc = (src: string) => {
    src = prepareBackendLink(src);
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

  // Click opens the preview modal for our own attachments; external URLs keep browser default.
  const handleClick = () => {
    const key = extractAttachmentKeyFromUrl(src);
    if (key) {
      openPreview(key);
    }
  };

  return (
    <NodeViewWrapper
      data-drag-handle
      contentEditable={false}
      className={selected ? "selected-image" : ""}
    >
      <Box
        sx={{
          paddingY: M2,
          width: "fit-content",
          cursor: extractAttachmentKeyFromUrl(src) ? "zoom-in" : "default",
        }}
        onClick={handleClick}
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
            ...(node.attrs.style ? parseInlineStyle(node.attrs.style) : {}),
          }}
        ></Box>
      </Box>
    </NodeViewWrapper>
  );
}
