// ---------------------------------------------------------------------------
// collabContentLog
// Debug instrumentation for the Hocuspocus content lifecycle. Every line
// is prefixed with `[collab-content]` so it can be filtered from the
// console noise (the render/rAF logs use their own prefixes).
//
// The three events that matter for "reload then switch to write shows an
// empty editor":
//
//   - connected       — the provider reached the server (status / synced).
//   - content-received — the shared Y.Doc got content from the server (or
//                        from the local draft), with the content itself.
//   - content-set     — we wrote content into the Y.Doc (markdown or a
//                        direct XmlFragment write).
//
// `instrumentCollabSession` also logs the doc content on every fragment
// mutation together with the transaction origin, so a local write can be
// told apart from a server update.
// ---------------------------------------------------------------------------

import * as Y from "yjs";
import type { HocuspocusProvider } from "@hocuspocus/provider";

const PREFIX = "[collab-content]";

/** Read the shared fragment of a doc; `null` when there is no usable doc. */
function fragmentOf(ydoc: Y.Doc | null | undefined): Y.XmlFragment | null {
  if (!ydoc || typeof ydoc.getXmlFragment !== "function") return null;
  try {
    return ydoc.getXmlFragment("default");
  } catch {
    // Logging must never break the caller; a partial or destroyed doc
    // (e.g. a test double) is simply reported as having no content.
    return null;
  }
}

/**
 * Describe a Yjs transaction origin so the log tells local writes,
 * server updates and persistence rehydration apart. Yjs gives us no
 * marker, so the constructor name is the best available signal.
 */
function describeOrigin(origin: unknown): string {
  if (origin === null || origin === undefined) return "local(null)";
  if (typeof origin === "object" && "constructor" in origin) {
    return (origin as { constructor: { name?: string } }).constructor
      ?.name ?? "object";
  }
  if (typeof origin === "string" || typeof origin === "number") {
    return String(origin);
  }
  return "other";
}

/** Current top-level node count of the shared fragment; -1 when there is no doc. */
export function fragmentLength(ydoc: Y.Doc | null | undefined): number {
  const fragment = fragmentOf(ydoc);
  return fragment ? fragment.length : -1;
}

/** Current shared fragment content as XML text; "" when there is no doc. */
export function fragmentText(ydoc: Y.Doc | null | undefined): string {
  const fragment = fragmentOf(ydoc);
  if (!fragment || typeof fragment.toString !== "function") return "";
  try {
    return fragment.toString();
  } catch {
    return "";
  }
}

/** Recursively collect the text held by a Yjs XML node. */
function xmlNodeText(node: Y.XmlElement | Y.XmlText | Y.XmlHook): string {
  if (node instanceof Y.XmlText) return node.toString();
  if (node instanceof Y.XmlElement) {
    return node
      .toArray()
      .map((child) => xmlNodeText(child))
      .join("");
  }
  return "";
}

/**
 * Whether the shared fragment holds *meaningful* content. An editor that
 * has never been populated still materialises a single empty paragraph,
 * so `fragment.length > 0` is not enough to tell "server has a live note"
 * from "the room only contains an empty placeholder paragraph".
 */
export function fragmentHasContent(ydoc: Y.Doc | null | undefined): boolean {
  const fragment = fragmentOf(ydoc);
  if (!fragment || fragment.length === 0) return false;
  try {
    return fragment.toArray().some((node) => {
      if (!(node instanceof Y.XmlElement)) return true;
      if (xmlNodeText(node).trim().length > 0) return true;
      // An empty paragraph is a placeholder, not live content. Any other
      // node type (image, table, list, ...) counts as content even with
      // no text.
      return node.nodeName !== "paragraph";
    });
  } catch {
    // Be conservative: if the fragment cannot be inspected, do not seed.
    return true;
  }
}

/** Low-level emit. Kept in one place so the prefix never drifts. */
export function logCollabContent(
  event: string,
  noteId: string | undefined,
  payload?: Record<string, unknown>,
): void {
  console.log(
    `${PREFIX} ${event} note=${noteId ?? "-"}` +
      (payload ? " " + JSON.stringify(payload) : ""),
  );
}

/**
 * Log "we wrote content into the doc" for the markdown entry point in
 * `editorStore.setContent`. Records the markdown we were handed plus
 * what the fragment holds right after the write, so a write that did
 * not land is visible immediately. `via` separates the two write
 * paths: `ydoc-fragment` writes through the shared doc, `editor-cmd`
 * is the read-mode / fallback path that bypasses the Y.Doc.
 */
export function logContentSet(
  noteId: string | undefined,
  markdown: string,
  ydoc: Y.Doc | null | undefined,
  via: "ydoc-fragment" | "editor-cmd",
): void {
  logCollabContent("content-set", noteId, {
    via,
    markdownLen: markdown.length,
    markdownHead: markdown.slice(0, 120),
    fragmentLen: fragmentLength(ydoc),
    fragmentHead: fragmentText(ydoc).slice(0, 200),
  });
}

/** Guard so a reused cache entry is not instrumented twice. */
const instrumented = new WeakSet<Y.Doc>();

/**
 * D.Ydocs that have received at least one remote transaction. This is
 * deliberately separate from "the fragment is non-empty": a doc the
 * server had content for and the user then emptied must not be seeded
 * again from the last saved markdown when the provider reconnects.
 */
const serverContentDocs = new WeakSet<Y.Doc>();

/** Record that `ydoc` has received provider/server state. */
export function markServerContent(ydoc: Y.Doc): void {
  serverContentDocs.add(ydoc);
}

/** Whether `ydoc` has ever received state from the collaboration server. */
export function hasServerContent(
  ydoc: Y.Doc | null | undefined,
): boolean {
  return !!ydoc && serverContentDocs.has(ydoc);
}

/**
 * Attach content-lifecycle logging to a live collab session: provider
 * status, the handshake result, and every mutation of the shared
 * fragment (with its origin). Returns a detach function.
 *
 * Safe to call on a mocked provider (the offline tests do): every
 * subscription is guarded on the method existing.
 */
export function instrumentCollabSession(
  noteId: string | undefined,
  ydoc: Y.Doc,
  provider: HocuspocusProvider,
): () => void {
  if (instrumented.has(ydoc)) {
    logCollabContent("instrument-skipped(already)", noteId, {
      fragmentLen: fragmentLength(ydoc),
    });
    return () => {};
  }
  instrumented.add(ydoc);

  const on = provider?.on?.bind(provider);
  const off = provider?.off?.bind(provider);
  const wsStatus =
    provider?.configuration?.websocketProvider?.status ?? undefined;

  // State at attach time. On a read -> write flip the provider may have
  // synced before this ran, so the current doc is the interesting bit.
  logCollabContent("instrument", noteId, {
    synced: provider?.synced ?? false,
    authenticated: provider?.isAuthenticated ?? false,
    wsStatus: wsStatus ?? "unknown",
    fragmentLen: fragmentLength(ydoc),
    fragmentHead: fragmentText(ydoc).slice(0, 200),
  });

  const onStatus = (event: { status?: string }) => {
    logCollabContent(
      event?.status === "connected" ? "connected" : "status",
      noteId,
      {
        status: event?.status,
        fragmentLen: fragmentLength(ydoc),
      },
    );
  };
  const onSynced = () => {
    logCollabContent("synced", noteId, {
      fragmentLen: fragmentLength(ydoc),
      fragmentHead: fragmentText(ydoc).slice(0, 200),
    });
  };
  const onAuthenticated = () => {
    logCollabContent("authenticated", noteId);
  };
  const onAuthFailed = (event?: { reason?: string }) => {
    logCollabContent("authenticationFailed", noteId, {
      reason: event?.reason,
    });
  };

  on?.("status", onStatus);
  on?.("synced", onSynced);
  on?.("authenticated", onAuthenticated);
  on?.("authenticationFailed", onAuthFailed);

  // Every mutation of the shared fragment, tagged with its origin. This
  // is the line that shows whether the server content ever arrived and
  // whether the local editor write overwrote it.
  const fragment = fragmentOf(ydoc);
  const observer = (
    _events: Y.YEvent<Y.AbstractType<unknown>>[],
    transaction: Y.Transaction,
  ) => {
    const origin = describeOrigin(transaction?.origin);
    // The provider hands itself to `readSyncMessage` as the update origin,
    // so an identity check is exact where the constructor name may be
    // mangled by the bundler.
    const isRemote =
      transaction?.origin === provider || origin === "HocuspocusProvider";
    // Only a remote transaction that leaves meaningful content counts as
    // server state. An empty placeholder paragraph must not block seeding
    // the saved markdown into a brand-new room.
    if (isRemote && (fragmentHasContent(ydoc) || hasServerContent(ydoc))) {
      markServerContent(ydoc);
    }
    logCollabContent(isRemote ? "content-received" : "content-changed", noteId, {
      origin,
      fragmentLen: fragmentLength(ydoc),
      fragmentHead: fragmentText(ydoc).slice(0, 200),
    });
  };
  fragment?.observeDeep?.(observer);

  return () => {
    off?.("status", onStatus);
    off?.("synced", onSynced);
    off?.("authenticated", onAuthenticated);
    off?.("authenticationFailed", onAuthFailed);
    fragment?.unobserveDeep?.(observer);
    instrumented.delete(ydoc);
  };
}
