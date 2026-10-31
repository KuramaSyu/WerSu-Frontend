// Tier 2 tests for the awareness bridge.
//
// The bridge owns presence cleanup: when the local session stops (the
// user leaves edit mode, changes notes, or unmounts), this client must
// be removed from the shared awareness set. Otherwise the provider
// keeps broadcasting stale presence and collaborators still see the
// user on the draft entry after they stopped editing.

// @vitest-environment jsdom

import "../../test/setup";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { render } from "@testing-library/react";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { LiveUsersBridge } from "./LiveUsersBridge";
import { useLiveUsersStore } from "../../zustand/useLiveUsersStore";

function createProvider(userId = "u1") {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  awareness.setLocalState({
    user: { id: userId, color: "#f00", name: "Ada", avatar: undefined },
  });
  const disconnect = vi.fn();
  const provider = {
    awareness,
    disconnect,
  } as unknown as HocuspocusProvider;
  return { provider, awareness, disconnect, doc };
}

beforeEach(() => {
  useLiveUsersStore.setState({ usersByNoteId: {} });
});

describe("LiveUsersBridge", () => {
  it("publishes the current awareness users", () => {
    const { provider } = createProvider();

    render(
      <LiveUsersBridge noteId="n1" provider={provider} enabled />,
    );

    expect(useLiveUsersStore.getState().usersByNoteId.n1).toHaveLength(1);
    expect(useLiveUsersStore.getState().usersByNoteId.n1[0].userId).toBe(
      "u1",
    );
  });

  it("removes the client's user from awareness when the session stops", async () => {
    const { provider, awareness, disconnect } = createProvider();

    const { rerender } = render(
      <LiveUsersBridge noteId="n1" provider={provider} enabled />,
    );

    // Leaving edit mode: the editor passes no provider and disables the
    // bridge. The cleanup must run against the previous provider.
    rerender(<LiveUsersBridge noteId="n1" provider={null} enabled={false} />);

    expect(useLiveUsersStore.getState().usersByNoteId.n1).toEqual([]);
    await vi.waitFor(() => {
      expect(awareness.getLocalState()).not.toBeNull();
      expect(awareness.getLocalState()?.user).toBeUndefined();
    });
    // We deliberately keep the socket open so re-entry doesn't trip the
    // auto-offline fallback.
    expect(disconnect).not.toHaveBeenCalled();
  });

  it("removes the client's user from awareness on unmount", async () => {
    const { provider, awareness, disconnect } = createProvider();

    const { unmount } = render(
      <LiveUsersBridge noteId="n1" provider={provider} enabled />,
    );

    unmount();

    expect(useLiveUsersStore.getState().usersByNoteId.n1).toEqual([]);
    await vi.waitFor(() => {
      expect(awareness.getLocalState()).not.toBeNull();
      expect(awareness.getLocalState()?.user).toBeUndefined();
    });
    expect(disconnect).not.toHaveBeenCalled();
  });

  it("can re-add the user after leaving and re-entering edit mode", async () => {
    const { provider, awareness } = createProvider();

    const { rerender } = render(
      <LiveUsersBridge noteId="n1" provider={provider} enabled />,
    );

    rerender(<LiveUsersBridge noteId="n1" provider={null} enabled={false} />);
    await vi.waitFor(() => {
      expect(awareness.getLocalState()?.user).toBeUndefined();
    });

    // CollaborationCaret re-adds the user through setLocalStateField on
    // the re-created editor; that only works when local state is not null.
    awareness.setLocalStateField("user", {
      id: "u1",
      color: "#f00",
      name: "Ada",
    });
    rerender(<LiveUsersBridge noteId="n1" provider={provider} enabled />);

    expect(useLiveUsersStore.getState().usersByNoteId.n1).toHaveLength(1);
    expect(useLiveUsersStore.getState().usersByNoteId.n1[0].userId).toBe(
      "u1",
    );
  });

  it("keeps presence through StrictMode's effect remount", async () => {
    const { provider, awareness, disconnect } = createProvider();

    render(
      <StrictMode>
        <LiveUsersBridge noteId="n1" provider={provider} enabled />
      </StrictMode>,
    );

    // Give the deferred teardown a chance to (incorrectly) run.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(awareness.getLocalState()?.user).toBeDefined();
    expect(disconnect).not.toHaveBeenCalled();
    expect(useLiveUsersStore.getState().usersByNoteId.n1).toHaveLength(1);
  });

  it("drops remote users that leave the awareness set", () => {
    const { provider, awareness } = createProvider("me");

    render(<LiveUsersBridge noteId="n1" provider={provider} enabled />);

    // Simulate a remote peer announcing itself, then leaving.
    awareness.setLocalState({
      user: { id: "me", color: "#f00" },
    });
    awareness.getStates().set(999, {
      user: { id: "peer", color: "#0f0" },
    });
    awareness.emit("change", []);
    expect(
      useLiveUsersStore.getState().usersByNoteId.n1.map((u) => u.userId),
    ).toContain("peer");

    awareness.getStates().delete(999);
    awareness.emit("change", []);
    expect(
      useLiveUsersStore.getState().usersByNoteId.n1.map((u) => u.userId),
    ).not.toContain("peer");
  });
});
