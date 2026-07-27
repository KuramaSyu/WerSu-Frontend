import { create } from "zustand";

/**
 * Holds the attachment key currently being previewed as a full-size
 * modal. `ImageNodeView` and `SvgLinkNodeView` call `open(key)` on
 * click; `AttachmentPreviewModal` reads the key and renders the
 * `AttachmentView`. One store, one modal — not one per node.
 */
interface AttachmentPreviewState {
  /** Attachment key currently being previewed, or `null`. */
  key: string | null;
  /** Open the preview modal for `key`. */
  open: (key: string) => void;
  /** Close the preview modal. */
  close: () => void;
}

export const useAttachmentPreviewStore = create<AttachmentPreviewState>(
  (set) => ({
    key: null,
    open: (key) => set({ key }),
    close: () => set({ key: null }),
  }),
);
