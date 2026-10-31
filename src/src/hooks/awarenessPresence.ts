import type { HocuspocusProvider } from "@hocuspocus/provider";

/**
 * Drops the local `user` field from the provider's awareness state while
 * keeping the state itself non-null.
 *
 * Peers only render awareness entries that carry a `user`, so this hides
 * the viewer from the live-editor list. Keeping the state non-null is
 * important: `CollaborationCaret` re-adds the user through
 * `awareness.setLocalStateField("user", …)`, which is a no-op when the
 * local state is `null`.
 */
export function clearLocalUserPresence(
  provider: HocuspocusProvider | null | undefined,
): void {
  const awareness = provider?.awareness;
  if (!awareness) return;
  const localState = awareness.getLocalState();
  if (!localState?.user) return;
  const nextState = { ...localState };
  delete nextState.user;
  awareness.setLocalState(nextState);
}
