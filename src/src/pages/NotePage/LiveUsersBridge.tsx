import { useEffect } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { useLiveUsersStore } from "../../zustand/useLiveUsersStore";

export interface LiveUsersBridgeProps {
  noteId: string | undefined;
  provider: HocuspocusProvider | null;
  /** Only attach the awareness subscription when the user is editing. */
  enabled: boolean;
}

/**
 * owns awareness of live-users and receives its updates. its separated to
 * resuce editor-rerenders
 */
export const LiveUsersBridge: React.FC<LiveUsersBridgeProps> = ({
  noteId,
  provider,
  enabled,
}) => {
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
