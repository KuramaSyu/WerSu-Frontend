import { Box } from "@mui/material";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useRef } from "react";
import { useThemeStore } from "../../../zustand/useThemeStore";
import { M2 } from "../../../statics";
import { useEditorSettings } from "../../../zustand/useEditorSettings";
import { useAuthStore } from "../../../zustand/useAuthStore";
import { useAttachmentPreviewStore } from "../../../zustand/useAttachmentPreviewStore";
import { AttachmentApi } from "../../../api/AttachmentApi";
import { AttachmentLinkBuilder } from "../../../api/utils/AttachmentLInkBuilder";
import { extractAttachmentKeyFromUrl } from "../../../api/utils/request_helpers";
import { prepareBackendLink } from "../../../utils/prepareBackendLink";

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

// Parse a CSS declaration string like "width: 200px; height: 100px" into
// an object MUI's sx understands. Splits on ; and : and trims.
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

  // use zustand selectors to reduce per-render work
  const editMode = useEditorSettings((s) => s.editMode);
  const openPreview = useAttachmentPreviewStore((s) => s.open);
  const shareAttachmentTokens = useAuthStore((s) => s.shareAttachmentTokens);
  const tokensLoaded = useAuthStore((s) => s.shareAttachmentTokensLoaded);

  const rawSrc = node.attrs.src ?? "";
  const preparedSrc = prepareBackendLink(rawSrc);
  const attachmentKey = extractAttachmentKeyFromUrl(preparedSrc);
  const resolved = attachmentKey
    ? useAuthStore.getState().resolveShareAttachmentToken(attachmentKey)
    : undefined;
  const jwt = resolved?.jwt;
  const resolvedKey = resolved?.key;

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
  }, [attachmentKey, jwt, tokensLoaded, shareAttachmentTokens, rawSrc]);

  // Append the share JWT so public users can load backend images. The
  // resolved key is what the backend stored in the tokens map, so the
  // builder has to use it for the JWT lookup to line up.
  const linkKey = resolvedKey ?? attachmentKey;
  const src =
    !linkKey || !jwt
      ? preparedSrc
      : new AttachmentLinkBuilder(new AttachmentApi())
          .setJwt(jwt)
          .getLink(linkKey);

  // Click opens the preview modal for our own attachments; external URLs keep browser default.
  const handleClick = () => {
    if (linkKey) {
      openPreview(linkKey);
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
          cursor: linkKey ? "zoom-in" : "default",
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
