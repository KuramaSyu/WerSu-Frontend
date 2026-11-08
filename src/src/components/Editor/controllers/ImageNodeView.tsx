import { Box } from "@mui/material";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useThemeStore } from "../../../zustand/useThemeStore";
import { M2 } from "../../../statics";
import { useEditorSettings } from "../../../zustand/useEditorSettings";
import { useAuthStore } from "../../../zustand/useAuthStore";
import { useAttachmentPreviewStore } from "../../../zustand/useAttachmentPreviewStore";
import { AttachmentApi } from "../../../api/AttachmentApi";
import { useShareAttachmentToken } from "../../../api/queries/useAttachmentQueries";
import { AttachmentLinkBuilder } from "../../../api/utils/AttachmentLInkBuilder";
import { extractAttachmentKeyFromUrl } from "../../../api/utils/request_helpers";
import { prepareBackendLink } from "../../../utils/prepareBackendLink";
import { defaultImageResizeStrategy, styleStringToSx } from "../imageResizeStrategy";
import {
  IMAGE_RESIZE_HANDLES,
  computeResize,
  geometryFromPixels,
  type ImageResizeHandle,
} from "../imageResize";
import { useImageResizeStore } from "../../../zustand/useImageResizeStore";

// ---------------------------------------------------------------------------
// ImageNodeView diagnostics
// All lines share the [image-nodeview] prefix so a devtools filter
// scopes the trace to this component. Tiptap mounts one NodeView per
// image, so the per-render log fires at most once per image per render.
// ---------------------------------------------------------------------------

const TAG = "[image-nodeview]";

// Tracks which keys we already warned about under the current token
// map. Re-primes on map replacement so the same key can warn again if
// the new map also lacks it (without re-priming a real bug hides).
const warnedKeysForCurrentMap = new Set<string>();

// Tracks the most recent map reference we warned against so the set
// is keyed on the current map identity rather than the page lifetime.
let lastWarnedMapRef: Record<string, string> | null = null;

// Reset the cache on map replacement so warnings re-fire if the new
// map still lacks the key. The replacement itself logs so the devtools
// timeline reads top-down.
useAuthStore.subscribe((state, prev) => {
  if (state.shareAttachmentTokens === prev.shareAttachmentTokens) return;
  const prevKeys = Object.keys(prev.shareAttachmentTokens);
  const nextKeys = Object.keys(state.shareAttachmentTokens);
  const added = nextKeys.filter((k) => !prevKeys.includes(k));
  const removed = prevKeys.filter((k) => !nextKeys.includes(k));
  // eslint-disable-next-line no-console
  console.log(`${TAG} shareAttachmentTokens map replaced`, {
    prevSize: prevKeys.length,
    nextSize: nextKeys.length,
    prevLoaded: prev.shareAttachmentTokensLoaded,
    nextLoaded: state.shareAttachmentTokensLoaded,
    added,
    removed,
  });
  if (state.shareAttachmentTokens !== lastWarnedMapRef) {
    warnedKeysForCurrentMap.clear();
  }
});

export function ImageNodeView({
  node,
  selected,
  getPos,
  editor,
  updateAttributes,
}: NodeViewProps) {
  const { theme } = useThemeStore();

  // use zustand selectors to reduce per-render work
  const editMode = useEditorSettings((s) => s.editMode);
  const aspectLocked = useImageResizeStore((s) => s.locked);

  // Live size while a handle is being dragged. Kept in local state so
  // the document is only updated once, on pointer up. Cleared before
  // committing so the persisted style takes over without a flash.
  const [previewSize, setPreviewSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  // Measured size of the rendered <img>; drives the handle positions so
  // they always sit on the visible image edges (independent of whether
  // the stored width is a px or % value).
  const [measuredSize, setMeasuredSize] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const update = () =>
      setMeasuredSize({ width: img.offsetWidth, height: img.offsetHeight });
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(img);
    return () => observer.disconnect();
    // Set up once per mounted <img>; the observer handles later size and
    // source changes, so no reactive deps are needed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const openPreview = useAttachmentPreviewStore((s) => s.open);
  const shareAttachmentTokens = useAuthStore((s) => s.shareAttachmentTokens);
  const tokensLoaded = useAuthStore((s) => s.shareAttachmentTokensLoaded);
  // Per-attachment JWTs are exclusively a public-share mechanism. The
  // `shareAccessToken` is set only while a share session is active
  // (anonymous viewer, or a logged-in viewer on `/public/*`). Logged-in
  // users off `/public` authenticate via the session cookie and the
  // proxy resolves the attachment without any JWT, so neither fetching
  // a fresh token nor appending one is warranted there.
  const isPublicShareSession = useAuthStore(
    (s) => s.shareAccessToken !== null,
  );

  const rawSrc = node.attrs.src ?? "";
  const preparedSrc = prepareBackendLink(rawSrc);
  const attachmentKey = extractAttachmentKeyFromUrl(preparedSrc);
  const resolved = attachmentKey
    ? useAuthStore.getState().resolveShareAttachmentToken(attachmentKey)
    : undefined;
  const jwt = resolved?.jwt;
  const resolvedKey = resolved?.key;

  // Live-collab rescue: another collaborator (or a public user) uploads
  // an image, the node appears, but the note's initial token map was
  // snapshotted before the upload. `tokensLoaded` marks a public-share
  // session; if we still have no JWT for the key, ask the backend for a
  // fresh scoped one. The hook merges it into the auth store, which
  // re-renders this node view and appends it to the image `src` below.
  const needsAttachmentToken =
    Boolean(attachmentKey) &&
    !jwt &&
    tokensLoaded &&
    isPublicShareSession;
  useShareAttachmentToken(attachmentKey, needsAttachmentToken);

  // One-time diagnostic dump: list the map's keys vs the key the
  // nodeview is asking for, so a mismatch is visible without devtools
  // state inspection. Fires once per key, like the warning itself.
  useEffect(() => {
    if (!attachmentKey) return;
    if (jwt) return;
    if (!tokensLoaded) return;
    const mapKeys = Object.keys(shareAttachmentTokens);
    const hasExact = mapKeys.includes(attachmentKey);
    // Heuristic: maybe the map uses the prefixed form
    // (attachments/<uuid>) while the URL yields just the leaf.
    const looksLikePrefixed = mapKeys.some(
      (k) =>
        k === `attachments/${attachmentKey}` || k.endsWith(`/${attachmentKey}`),
    );
    // eslint-disable-next-line no-console
    console.log(`${TAG} key-comparison`, {
      asked: attachmentKey,
      resolved: resolvedKey,
      mapKeys,
      hasExact,
      looksLikePrefixed,
      // First 32 chars of each map key so a suffix mismatch is visible
      // in the log without dumping the full map.
      mapKeyPrefixes: mapKeys.map((k) => k.slice(0, 32)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachmentKey, resolvedKey, jwt, tokensLoaded, shareAttachmentTokens]);

  // Per-render trace. Logged at render (not in an effect) because the
  // question we are answering is "why did this nodeview re-render",
  // and effects always lag by a tick.
  const lastLoggedKeyRef = useRef<string | null | undefined>(undefined);
  const lastLoggedJwtRef = useRef<string | undefined>(undefined);
  const lastLoggedTokensLoadedRef = useRef<boolean | undefined>(undefined);
  if (lastLoggedKeyRef.current !== attachmentKey) {
    // eslint-disable-next-line no-console
    console.log(
      `${TAG} render key=${attachmentKey ?? "<none>"} hasJwt=${!!jwt} tokensLoaded=${tokensLoaded} mapSize=${Object.keys(shareAttachmentTokens).length} rawSrc=${rawSrc.slice(0, 80)}`,
    );
    lastLoggedKeyRef.current = attachmentKey;
    lastLoggedJwtRef.current = jwt;
    lastLoggedTokensLoadedRef.current = tokensLoaded;
  } else if (
    lastLoggedJwtRef.current !== jwt ||
    lastLoggedTokensLoadedRef.current !== tokensLoaded
  ) {
    // eslint-disable-next-line no-console
    console.log(
      `${TAG} re-render key=${attachmentKey} hasJwt=${!!jwt} tokensLoaded=${tokensLoaded} mapSize=${Object.keys(shareAttachmentTokens).length} reason=${
        lastLoggedJwtRef.current !== jwt ? "jwtChanged" : "tokensLoadedChanged"
      }`,
    );
    lastLoggedJwtRef.current = jwt;
    lastLoggedTokensLoadedRef.current = tokensLoaded;
  }

  // Effect-based warning. Fires here (not at render) so the warning
  // is observable even when the component renders and unmounts before
  // the next paint. Re-evaluates on jwt/tokensLoaded flips so a late
  // token cancels the warning before it ever fires.
  useEffect(() => {
    if (!attachmentKey) {
      // eslint-disable-next-line no-console
      console.log(
        `${TAG} effect:no-key rawSrc=${rawSrc.slice(0, 80)} (no warning needed)`,
      );
      return;
    }
    if (!isPublicShareSession) {
      // Logged-in users off `/public` get the image through the session
      // cookie; a missing per-attachment JWT is expected, not a bug.
      return;
    }
    if (jwt) {
      // eslint-disable-next-line no-console
      console.log(
        `${TAG} effect:has-jwt key=${attachmentKey} (image will load)`,
      );
      return;
    }
    if (!tokensLoaded) {
      // eslint-disable-next-line no-console
      console.log(
        `${TAG} effect:tokens-not-loaded key=${attachmentKey} (deferring warn until map is loaded)`,
      );
      return;
    }
    if (shareAttachmentTokens !== lastWarnedMapRef) {
      warnedKeysForCurrentMap.clear();
      lastWarnedMapRef = shareAttachmentTokens;
    }
    if (warnedKeysForCurrentMap.has(attachmentKey)) {
      // eslint-disable-next-line no-console
      console.log(
        `${TAG} effect:already-warned key=${attachmentKey} (suppressing repeat)`,
      );
      return;
    }
    warnedKeysForCurrentMap.add(attachmentKey);
    // eslint-disable-next-line no-console
    console.warn(
      `${TAG} No share-attachment JWT found for attachment key ${attachmentKey} (resolved=${resolvedKey ?? "<none>"}). The image WILL not load for public users. tokensLoaded=${tokensLoaded} mapSize=${Object.keys(shareAttachmentTokens).length}`,
    );
  }, [
    attachmentKey,
    jwt,
    tokensLoaded,
    isPublicShareSession,
    shareAttachmentTokens,
    rawSrc,
  ]);

  // Append the share JWT so public users can load backend images. The
  // resolved key is what the backend stored in the tokens map, so the
  // builder has to use it for the JWT lookup to line up.
  const linkKey = resolvedKey ?? attachmentKey;
  // Only public-share sessions put a JWT on the image URL. For logged-in
  // users the plain URL is correct and cheaper (no token in the query
  // string, so the browser/proxy can cache normally).
  const src =
    !linkKey || !jwt || !isPublicShareSession
      ? preparedSrc
      : new AttachmentLinkBuilder(new AttachmentApi())
          .setJwt(jwt)
          .getLink(linkKey);

  // Single click selects the node so its handles appear. In read mode
  // the editor has no selection to show, so fall back to the preview.
  const handleClick = () => {
    if (!editMode) {
      if (linkKey) openPreview(linkKey);
      return;
    }
    if (selected) return;
    const pos = getPos();
    if (typeof pos === "number") {
      editor.commands.setNodeSelection(pos);
    }
  };

  // Double click opens the preview modal for our own attachments;
  // external URLs keep the browser default.
  const handleDoubleClick = (event: ReactMouseEvent) => {
    if (!linkKey) return;
    event.preventDefault();
    openPreview(linkKey);
  };

  const previousStyle = node.attrs.style as string | null;
  const beginResize = useCallback(
    (handle: ImageResizeHandle) => (event: PointerEvent) => {
      const img = imgRef.current;
      if (!img) return;
      event.preventDefault();
      event.stopPropagation();

      const rect = img.getBoundingClientRect();
      const startWidth = rect.width;
      const startHeight = rect.height;
      const aspectRatio =
        img.naturalWidth > 0 && img.naturalHeight > 0
          ? img.naturalWidth / img.naturalHeight
          : startWidth / Math.max(startHeight, Number.EPSILON);
      const startX = event.clientX;
      const startY = event.clientY;
      let last = { width: startWidth, height: startHeight };

      const onMove = (moveEvent: PointerEvent) => {
        last = computeResize({
          handle,
          dx: moveEvent.clientX - startX,
          dy: moveEvent.clientY - startY,
          startWidth,
          startHeight,
          aspectRatio,
          locked: aspectLocked,
        });
        setPreviewSize(last);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        setPreviewSize(null);
        const geometry = geometryFromPixels(
          defaultImageResizeStrategy,
          { ...last, aspectRatio },
          aspectLocked,
        );
        updateAttributes({
          style: defaultImageResizeStrategy.serialize(geometry, previousStyle),
        });
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [aspectLocked, previousStyle, updateAttributes],
  );

  const showHandles = selected && editMode;

  // ProseMirror and the block drag-handle listen on ancestors of the
  // handles, and React's delegated handlers fire too late to stop them.
  // A capture-phase native listener on the container intercepts the
  // event before it reaches either.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !showHandles) return;

    const handleFromEvent = (event: Event): ImageResizeHandle | null => {
      const target = event.target as HTMLElement | null;
      const handleElement = target?.closest?.(
        "[data-resize-handle]",
      ) as HTMLElement | null;
      return (
        (handleElement?.dataset.resizeHandle as ImageResizeHandle) ?? null
      );
    };

    const onPointerDown = (event: Event) => {
      const handle = handleFromEvent(event);
      if (!handle) return;
      event.stopPropagation();
      event.preventDefault();
      beginResize(handle)(event as PointerEvent);
    };

    const stopHandleClick = (event: Event) => {
      if (handleFromEvent(event)) event.stopPropagation();
    };

    container.addEventListener("pointerdown", onPointerDown, true);
    container.addEventListener("click", stopHandleClick, true);
    return () => {
      container.removeEventListener("pointerdown", onPointerDown, true);
      container.removeEventListener("click", stopHandleClick, true);
    };
  }, [beginResize, showHandles]);

  // The container is a full-width positioning context; the <img> keeps
  // its own width/height (px or %). Handle coordinates come from the
  // measured image box so percentages can never misplace them.
  const extraSx = styleStringToSx(node.attrs.style);
  const handleSize = previewSize ?? measuredSize;
  const handlePositions: Record<
    ImageResizeHandle,
    { left: number; top: number }
  > = {
    nw: { left: 0, top: 0 },
    n: { left: handleSize.width / 2, top: 0 },
    ne: { left: handleSize.width, top: 0 },
    e: { left: handleSize.width, top: handleSize.height / 2 },
    se: { left: handleSize.width, top: handleSize.height },
    s: { left: handleSize.width / 2, top: handleSize.height },
    sw: { left: 0, top: handleSize.height },
    w: { left: 0, top: handleSize.height / 2 },
  };

  return (
    <NodeViewWrapper
      data-drag-handle
      contentEditable={false}
      className={selected ? "selected-image" : ""}
    >
      <Box sx={{ paddingY: M2 }}>
        <Box
          ref={containerRef}
          className="image-resize-container"
          sx={{ cursor: linkKey ? "zoom-in" : "default" }}
        >
          <Box
            component={"img"}
            ref={imgRef}
            src={src}
            alt={src}
            draggable={false}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            sx={{
              display: "block",
              maxWidth: "100%",
              outline:
                selected && editMode
                  ? `2px solid ${theme.palette.primary.main}`
                  : "none",
              outlineOffset: "2px",
              transition: "outline 0.2s ease",
              borderRadius: 1,
              ...extraSx,
              ...(previewSize
                ? {
                    width: `${previewSize.width}px`,
                    height: `${previewSize.height}px`,
                  }
                : {}),
            }}
          ></Box>
          {showHandles &&
            IMAGE_RESIZE_HANDLES.map((handle) => {
              const position = handlePositions[handle];
              return (
                <span
                  key={handle}
                  role="presentation"
                  data-resize-handle={handle}
                  className={`image-resize-handle image-resize-handle--${handle}`}
                  style={{
                    left: position.left,
                    top: position.top,
                    color: theme.palette.primary.main,
                  }}
                />
              );
            })}
        </Box>
      </Box>
    </NodeViewWrapper>
  );
}
