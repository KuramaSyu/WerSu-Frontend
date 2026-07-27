import { useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Box, IconButton, Tooltip } from "@mui/material";
import { IconDownload } from "@tabler/icons-react";
import { ATTACHMENTS_API_PATH } from "../../../api/AttachmentApi";
import { extractAttachmentKeyFromUrl } from "../../../api/utils/request_helpers";
import { BACKEND_BASE, M2 } from "../../../statics";
import { useThemeStore } from "../../../zustand/useThemeStore";
import { useEditorSettings } from "../../../zustand/useEditorSettings";
import { useAttachmentPreviewStore } from "../../../zustand/useAttachmentPreviewStore";
import { prepareBackendLink } from "../../../utils/prepareBackendLink";

/**
 * Renders an `<svgLink>` node. The `href` or `label` ending in
 * `.svg` -> render `<a><img></a>`; anything else falls back to
 * `<a>label</a>` for HTML-paste round-trips.
 *
 * Plain left-click opens the attachment preview modal
 * (`AttachmentPreviewModal`). Cmd/ctrl/shift/middle-clicks fall
 * through to the wrapper's native `<a href>` for "open in new tab".
 *
 * Hover surfaces a download button pointing at the original
 * attachment endpoint (`/api/attachments/?key=<encoded>`) rather
 * than any transformed image variant.
 */
export function SvgLinkNodeView({ node, selected }: NodeViewProps) {
  const { theme } = useThemeStore();
  const { editMode } = useEditorSettings();
  const openPreview = useAttachmentPreviewStore((s) => s.open);
  const [isHovered, setIsHovered] = useState(false);

  const href = String(node.attrs.href ?? "");
  const label = String(node.attrs.label ?? "");
  // Two signals so attachment URLs whose path lacks an extension still render as SVGs.
  const isSvg = /\.svg(?:[?#]|$)/i.test(href) || /\.svg$/i.test(label);

  // Backend-relative -> absolute so the browser doesn't resolve against the editor's origin.
  const resolvedHref = prepareBackendLink(href);
  const resolvedSrc = isSvg ? prepareBackendLink(href) : "";

  const attachmentKey = extractAttachmentKeyFromUrl(href);
  const downloadHref = attachmentKey
    ? `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/?key=${encodeURIComponent(attachmentKey)}`
    : resolvedHref;
  const downloadName = label || "attachment";

  const handleDownload = (event: React.MouseEvent) => {
    // Don't let the parent `<a>` also fire.
    event.preventDefault();
    event.stopPropagation();
    const a = document.createElement("a");
    a.href = downloadHref;
    a.download = downloadName;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleClick = (event: React.MouseEvent) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.button !== 0
    ) {
      return;
    }
    if (attachmentKey) {
      event.preventDefault();
      openPreview(attachmentKey);
    }
  };

  return (
    <NodeViewWrapper
      as={isSvg ? "a" : "span"}
      href={isSvg ? resolvedHref : undefined}
      target={isSvg ? "_blank" : undefined}
      rel={isSvg ? "noopener noreferrer" : undefined}
      data-drag-handle
      contentEditable={false}
      className={selected ? "selected-svg-link" : ""}
      onClick={isSvg ? handleClick : undefined}
      onMouseEnter={isSvg ? () => setIsHovered(true) : undefined}
      onMouseLeave={isSvg ? () => setIsHovered(false) : undefined}
      style={{
        position: isSvg ? "relative" : "static",
        display: isSvg ? "inline-block" : "inline",
        verticalAlign: isSvg ? "middle" : "baseline",
        padding: isSvg ? `${M2} 0` : undefined,
        cursor: isSvg ? "zoom-in" : undefined,
      }}
    >
      {isSvg ? (
        <>
          <Box
            component="img"
            src={resolvedSrc}
            alt={label}
            sx={{
              display: "block",
              maxWidth: "100%",
              outline:
                selected && editMode
                  ? `2px solid ${theme.palette.primary.main}`
                  : "none",
              outlineOffset: "2px",
              transition: "outline 0.2s ease",
            }}
          />
          {isHovered && (
            <Tooltip title={`Download original (${downloadName})`}>
              <IconButton
                size="small"
                onClick={handleDownload}
                aria-label={`Download ${downloadName}`}
                sx={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  backgroundColor: "background.paper",
                  boxShadow: 1,
                  "&:hover": { backgroundColor: "background.default" },
                }}
              >
                <IconDownload size={16} />
              </IconButton>
            </Tooltip>
          )}
        </>
      ) : (
        <a href={resolvedHref} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      )}
    </NodeViewWrapper>
  );
}
