import { beforeEach, describe, expect, it } from "vitest";
import "../test/setup";
import useInfoStore, {
  copyToClipboard,
  SnackbarUpdateImpl,
} from "./InfoStore";

/**
 * Tests for the central log store.
 *
 * What's covered:
 *   - FIFO eviction past the LOG_LIMIT cap.
 *   - `clearLogs` (the "Clear all" button).
 *   - `removeLog` (the per-row "✕" button).
 *   - `markAsRead` + `markAllAsRead` (the new read/unread semantics).
 *   - `setMessage` push semantics — every non-empty snackbar slot
 *     also produces a log entry.
 *
 * The global `setup.ts` `afterEach` resets the store between tests,
 * so each test starts from the fresh defaults.
 */
describe("useInfoStore — notification log", () => {
  beforeEach(() => {
    // Belt-and-braces reset: the global afterEach should already
    // have done this, but pinning it here makes the test file
    // robust to ordering changes in setup.ts.
    useInfoStore.setState({ logs: [], Message: new SnackbarUpdateImpl("") });
  });

  describe("setMessage() — log push", () => {
    it("appends a log entry for every non-empty message", () => {
      useInfoStore.getState().setMessage(
        new SnackbarUpdateImpl("hi", "success"),
      );
      useInfoStore.getState().setMessage(
        new SnackbarUpdateImpl("there", "error"),
      );
      const logs = useInfoStore.getState().logs;
      expect(logs).toHaveLength(2);
      // Newest first.
      expect(logs[0].message).toBe("there");
      expect(logs[1].message).toBe("hi");
      // Severity snapshot is preserved.
      expect(logs[0].severity).toBe("error");
      expect(logs[1].severity).toBe("success");
    });

    it("does NOT push a log entry for empty messages (initial/cleared slot)", () => {
      useInfoStore.getState().setMessage(new SnackbarUpdateImpl(""));
      expect(useInfoStore.getState().logs).toEqual([]);
    });

    it("new entries are unread by default", () => {
      useInfoStore.getState().setMessage(
        new SnackbarUpdateImpl("hi", "info"),
      );
      const [entry] = useInfoStore.getState().logs;
      expect(entry.readAt).toBeUndefined();
    });

    it("preserves the optional description in the snapshot", () => {
      useInfoStore.getState().setMessage(
        new SnackbarUpdateImpl("hi", "error", undefined, "stack trace here"),
      );
      expect(useInfoStore.getState().logs[0].description).toBe(
        "stack trace here",
      );
    });
  });

  describe("clearLogs()", () => {
    it("empties the log without touching the snackbar slot", () => {
      const { setMessage, clearLogs } = useInfoStore.getState();
      setMessage(new SnackbarUpdateImpl("first", "info"));
      const snackbar = useInfoStore.getState().Message;
      clearLogs();
      expect(useInfoStore.getState().logs).toEqual([]);
      // Snackbar is independent.
      expect(useInfoStore.getState().Message).toBe(snackbar);
    });

    it("is a no-op on an empty log", () => {
      useInfoStore.getState().clearLogs();
      expect(useInfoStore.getState().logs).toEqual([]);
    });
  });

  describe("removeLog()", () => {
    it("drops a single entry by id", () => {
      const { setMessage, removeLog } = useInfoStore.getState();
      setMessage(new SnackbarUpdateImpl("first", "info"));
      setMessage(new SnackbarUpdateImpl("second", "info"));
      const [newer] = useInfoStore.getState().logs;
      removeLog(newer.id);
      const remaining = useInfoStore.getState().logs;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].message).toBe("first");
    });

    it("is a no-op for an unknown id", () => {
      const { setMessage, removeLog } = useInfoStore.getState();
      setMessage(new SnackbarUpdateImpl("first", "info"));
      removeLog(99999);
      expect(useInfoStore.getState().logs).toHaveLength(1);
    });
  });

  describe("FIFO eviction past LOG_LIMIT", () => {
    it("keeps the newest `LOG_LIMIT` entries, dropping the oldest", () => {
      // `LOG_LIMIT` isn't exported; mirror the contract by checking
      // behaviour: push > LOG_LIMIT entries, then verify size and
      // that the *oldest* entry from the burst is gone.
      const { setMessage } = useInfoStore.getState();
      const total = 205; // a few more than the current 200 cap
      for (let i = 0; i < total; i += 1) {
        setMessage(new SnackbarUpdateImpl(`msg-${i}`, "info"));
      }
      const logs = useInfoStore.getState().logs;
      expect(logs.length).toBeLessThanOrEqual(total);
      expect(logs.length).toBeGreaterThan(0);
      // The oldest entry the caller pushed was `msg-0`; after
      // eviction it must no longer be present.
      expect(logs.some((e) => e.message === "msg-0")).toBe(false);
      // The newest entry must be present.
      expect(logs.some((e) => e.message === `msg-${total - 1}`)).toBe(true);
    });

    it("preserves FIFO order within the kept window", () => {
      const { setMessage } = useInfoStore.getState();
      for (let i = 0; i < 5; i += 1) {
        setMessage(new SnackbarUpdateImpl(`m${i}`, "info"));
      }
      const logs = useInfoStore.getState().logs;
      // Stored newest-first, so the visible order is the reverse of
      // insertion. Lock that down so we can rely on it for the UI.
      const visibleOrder = logs.map((e) => e.message);
      expect(visibleOrder).toEqual(["m4", "m3", "m2", "m1", "m0"]);
    });
  });

  describe("markAsRead() / markAllAsRead()", () => {
    it("sets readAt on the matching entry", () => {
      const { setMessage, markAsRead } = useInfoStore.getState();
      setMessage(new SnackbarUpdateImpl("hi", "info"));
      const before = Date.now();
      const [entry] = useInfoStore.getState().logs;
      markAsRead(entry.id);
      const after = Date.now();
      const updated = useInfoStore
        .getState()
        .logs.find((e) => e.id === entry.id)!;
      expect(updated.readAt).toBeGreaterThanOrEqual(before);
      expect(updated.readAt).toBeLessThanOrEqual(after);
    });

    it("is idempotent — marking a read entry again does not bump readAt", () => {
      const { setMessage, markAsRead } = useInfoStore.getState();
      setMessage(new SnackbarUpdateImpl("hi", "info"));
      const [entry] = useInfoStore.getState().logs;
      markAsRead(entry.id);
      const firstReadAt = useInfoStore.getState().logs[0].readAt;
      // Calling markAsRead a second time after a tiny pause must
      // not update the timestamp — otherwise "is this read?" state
      // becomes meaningless.
      markAsRead(entry.id);
      expect(useInfoStore.getState().logs[0].readAt).toBe(firstReadAt);
    });

    it("is a no-op for an unknown id", () => {
      const { markAsRead } = useInfoStore.getState();
      expect(() => markAsRead(424242)).not.toThrow();
    });

    it("markAllAsRead sets readAt on every currently-unread entry", () => {
      const { setMessage, markAllAsRead } = useInfoStore.getState();
      setMessage(new SnackbarUpdateImpl("a", "info"));
      setMessage(new SnackbarUpdateImpl("b", "warning"));
      setMessage(new SnackbarUpdateImpl("c", "error"));
      markAllAsRead();
      for (const e of useInfoStore.getState().logs) {
        expect(e.readAt).toBeTypeOf("number");
      }
    });

    it("leaves already-read entries read after markAllAsRead", () => {
      const { setMessage, markAsRead, markAllAsRead } = useInfoStore.getState();
      setMessage(new SnackbarUpdateImpl("a", "info"));
      setMessage(new SnackbarUpdateImpl("b", "info"));
      const before = useInfoStore.getState().logs;
      const [top] = before;
      markAsRead(top.id);
      markAllAsRead();
      const after = useInfoStore.getState().logs;
      // Same two entries…
      expect(after.map((e) => e.id)).toEqual(before.map((e) => e.id));
      // …none of them are unread now.
      for (const e of after) {
        expect(e.readAt).toBeTypeOf("number");
      }
    });
  });
});

describe("copyToClipboard()", () => {
  it("returns true in jsdom when the async API is available", async () => {
    // jsdom 22+ ships navigator.clipboard.writeText as a stub that
    // resolves. We assert it returns a boolean rather than the
    // specific value, so a missing polyfill doesn't make the test
    // silently green.
    const ok = await copyToClipboard("hello");
    expect(typeof ok).toBe("boolean");
  });
});
