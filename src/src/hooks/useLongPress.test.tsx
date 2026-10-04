// @vitest-environment jsdom

import "../test/setup";

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useLongPress } from "./useLongPress";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useLongPress", () => {
  it("fires onLongPress after the threshold elapses", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ threshold: 500, onLongPress }),
    );
    act(() => {
      result.current.onPointerDown({
        button: 0,
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        pointerType: "mouse",
      } as unknown as React.PointerEvent);
    });
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("does not fire onLongPress when the pointer releases early", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ threshold: 500, onLongPress }),
    );
    act(() => {
      result.current.onPointerDown({
        button: 0,
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        pointerType: "mouse",
      } as unknown as React.PointerEvent);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.onPointerUp();
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("cancels when the pointer moves past the tolerance", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ threshold: 500, moveTolerance: 5, onLongPress }),
    );
    act(() => {
      result.current.onPointerDown({
        button: 0,
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        pointerType: "mouse",
      } as unknown as React.PointerEvent);
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.onPointerMove({
        clientX: 100,
        clientY: 100,
      } as unknown as React.PointerEvent);
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("fires onPress on a short release", () => {
    const onPress = vi.fn();
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ threshold: 500, onPress, onLongPress }),
    );
    act(() => {
      result.current.onPointerDown({
        button: 0,
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        pointerType: "mouse",
      } as unknown as React.PointerEvent);
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.onPointerUp();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("ignores non-primary mouse buttons", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ threshold: 500, onLongPress }),
    );
    act(() => {
      result.current.onPointerDown({
        button: 2,
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        pointerType: "mouse",
      } as unknown as React.PointerEvent);
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("clears the timer on unmount", () => {
    const onLongPress = vi.fn();
    const { result, unmount } = renderHook(() =>
      useLongPress({ threshold: 500, onLongPress }),
    );
    act(() => {
      result.current.onPointerDown({
        button: 0,
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        pointerType: "mouse",
      } as unknown as React.PointerEvent);
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("flips longPressFired ref to true after a successful long-press", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ threshold: 500, onLongPress }),
    );
    act(() => {
      result.current.onPointerDown({
        button: 0,
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        pointerType: "mouse",
      } as unknown as React.PointerEvent);
    });
    expect(result.current.longPressFired.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.longPressFired.current).toBe(true);
  });

  it("resets longPressFired on the next pointer down", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ threshold: 500, onLongPress }),
    );
    act(() => {
      result.current.onPointerDown({
        button: 0,
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        pointerType: "mouse",
      } as unknown as React.PointerEvent);
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.longPressFired.current).toBe(true);
    act(() => {
      result.current.onPointerUp();
    });
    act(() => {
      result.current.onPointerDown({
        button: 0,
        clientX: 0,
        clientY: 0,
        pointerId: 2,
        pointerType: "mouse",
      } as unknown as React.PointerEvent);
    });
    expect(result.current.longPressFired.current).toBe(false);
  });
});
