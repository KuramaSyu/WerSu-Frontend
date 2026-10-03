import { memo, useEffect } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { useLiveUsersStore } from "../../zustand/useLiveUsersStore";
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
  useEffect(() => {
    const awareness = provider?.awareness;
    if (!awareness || !noteId || !enabled) {
      return;
    }

    const updateUsers = () => {
      const users = [];
      for (const state of awareness.getStates().values()) {
        if (state.user) {
          users.push({
            userId: state.user.id,
            color: state.user.color,
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
    };
  }, [noteId, provider, enabled]);

  return null;
};

export const LiveUsersBridge = memo(LiveUsersBridgeImpl);
