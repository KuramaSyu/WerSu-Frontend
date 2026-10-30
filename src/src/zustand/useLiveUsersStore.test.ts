import { beforeEach, describe, expect, it } from "vitest";
import { useLiveUsersStore } from "./useLiveUsersStore";

const store = useLiveUsersStore;

beforeEach(() => {
  store.setState({ usersByNoteId: {} });
});

describe("useLiveUsersStore", () => {
  it("stores the name and avatar carried by awareness", () => {
    store.getState().setUsers("n1", [
      {
        userId: "u1",
        color: "#f00",
        name: "Ada Lovelace",
        avatar: "https://cdn/a.png",
      },
    ]);

    expect(store.getState().usersByNoteId.n1[0]).toMatchObject({
      userId: "u1",
      name: "Ada Lovelace",
      avatar: "https://cdn/a.png",
    });
  });

  it("treats an avatar change as a real update", () => {
    store
      .getState()
      .setUsers("n1", [{ userId: "u1", color: "#f00", avatar: "old" }]);
    const first = store.getState().usersByNoteId.n1;

    store
      .getState()
      .setUsers("n1", [{ userId: "u1", color: "#f00", avatar: "new" }]);

    expect(store.getState().usersByNoteId.n1).not.toBe(first);
    expect(store.getState().usersByNoteId.n1[0].avatar).toBe("new");
  });

  it("drops a no-op update so subscribers do not re-render", () => {
    store
      .getState()
      .setUsers("n1", [{ userId: "u1", color: "#f00", name: "Ada" }]);
    const first = store.getState().usersByNoteId.n1;

    store
      .getState()
      .setUsers("n1", [{ userId: "u1", color: "#f00", name: "Ada" }]);

    expect(store.getState().usersByNoteId.n1).toBe(first);
  });
});
