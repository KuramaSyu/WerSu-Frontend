import { memo, useEffect, useRef } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { useLiveUsersStore } from "../../zustand/useLiveUsersStore";
import { clearLocalUserPresence } from "../../hooks/awarenessPresence";
import { logRerender } from "./editorRenderLog";

export interface LiveUsersBridgeProps {
  noteId: string | undefined;
  provider: HocuspocusProvider | null;
  /** Only attach the awareness subscription when the user is editing. */
  enabled: boolean;
}

/** Owns awareness of live users and its updates; separated to reduce editor rerenders. */
const LiveUsersBridgeImpl: React.FC<LiveUsersBridgeProps> = ({
  noteId,
  provider,
  enabled,
}) => {
  logRerender("LiveUsersBridge", { hasProvider: !!provider, enabled });
  // Pending presence teardowns, keyed by provider. Deferring lets the
  // re-mount that StrictMode performs in development cancel it, so we
  // don't strip presence from a session that is still alive.
  const teardownRef = useRef(
    new Map<HocuspocusProvider, ReturnType<typeof setTimeout>>(),
  );

  useEffect(() => {
    const awareness = provider?.awareness;
    if (!provider || !awareness || !noteId || !enabled) {
      return;
    }

    // Re-attaching to the same provider (StrictMode remount): cancel
    // the teardown the previous cleanup scheduled. The map itself is
    // stable for the component's lifetime; copy it for the cleanup.
    const pendingTeardowns = teardownRef.current;
    const pending = pendingTeardowns.get(provider);
    if (pending !== undefined) {
      clearTimeout(pending);
      pendingTeardowns.delete(provider);
    }

    const updateUsers = () => {
      const users = [];
      for (const state of awareness.getStates().values()) {
        if (state.user) {
          users.push({
            userId: state.user.id,
            color: state.user.color,
            name: state.user.name,
            avatar: state.user.avatar,
          });
        }
      }
      useLiveUsersStore.getState().setUsers(noteId, users);
    };

    awareness.on("change", updateUsers);
    updateUsers();

    return () => {
      awareness.off("change", updateUsers);
      useLiveUsersStore.getState().clearUsers(noteId);
      // Leaving the session (read mode, note change, or unmount) must
      // drop our user from the shared awareness state. Otherwise the
      // provider keeps broadcasting our presence and collaborators
      // still see us on the draft entry after we stop editing. We keep
      // a non-null local state (minus `user`) instead of clearing it,
      // because CollaborationCaret re-adds the user through
      // `setLocalStateField`, which is a no-op when local state is
      // null. Keeping the socket open also avoids tripping the
      // auto-offline fallback that fires on a prolonged disconnect.
      const timer = setTimeout(() => {
        pendingTeardowns.delete(provider);
        clearLocalUserPresence(provider);
      }, 0);
      pendingTeardowns.set(provider, timer);
    };
  }, [noteId, provider, enabled]);

  return null;
};

export const LiveUsersBridge = memo(LiveUsersBridgeImpl);
