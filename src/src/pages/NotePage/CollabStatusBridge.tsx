// ---------------------------------------------------------------------------
// CollabStatusBridge
//
// Owns the provider -> collab-status store subscription. Same rationale
// as LiveUsersBridge: keep it outside the editor body so editor
// transactions don't re-subscribe or re-run status work. The toolbar
// badge reads from `collabStatusStore` directly.
// ---------------------------------------------------------------------------

import { useEffect } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import {
  collabStatusStore,
  type CollabStatus,
} from "../../zustand/useCollabStatusStore";

export interface CollabStatusBridgeProps {
  noteId: string | undefined;
  provider: HocuspocusProvider | null;
  /** Only attach when the user is editing. */
  enabled: boolean;
}

export const CollabStatusBridge: React.FC<CollabStatusBridgeProps> = ({
  noteId,
  provider,
  enabled,
}) => {
  useEffect(() => {
    if (!noteId) {
      return;
    }
    if (!enabled) {
      collabStatusStore.getState().setStatus(noteId, "idle");
      return;
    }
    if (!provider) {
      return; // hook is waiting on the JWT — leave its diagnostic alone
    }

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
  }, [noteId, provider, enabled]);

  return null;
};
