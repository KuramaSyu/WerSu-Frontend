// @vitest-environment jsdom

// The preview is tested against the `renderMermaid` seam only: jsdom has no
// layout engine, so the real Mermaid renderer cannot run here. Deferred
// promises let us pin down the ordering guarantees (stale results must not
// overwrite newer ones).

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import "../../../test/setup";
import type { MermaidTheme } from "../mermaid/mermaidRenderer";
import { MermaidPreview } from "./MermaidPreview";

const { renderMermaid } = vi.hoisted(() => ({
  renderMermaid: vi.fn<
    (code: string, theme?: MermaidTheme) => Promise<string>
  >(),
}));

vi.mock("../mermaid/mermaidRenderer", () => ({ renderMermaid }));

interface Deferred {
  promise: Promise<string>;
  resolve: (svg: string) => void;
  reject: (reason: unknown) => void;
}

const deferred = (): Deferred => {
  let resolve!: (svg: string) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const svgFor = (label: string) =>
  `<svg data-mermaid-test="${label}"><text>${label}</text></svg>`;

// Real timers: the debounce is short (250 ms) and `waitFor` polls, so the
// tests stay deterministic without fake-timer/act interleaving headaches.
const waitForSvg = (container: HTMLElement, label: string) =>
  waitFor(() => {
    const svgHost = container.querySelector(
      "[data-mermaid-svg] svg[data-mermaid-test]"
    );
    expect(svgHost).not.toBeNull();
    expect(svgHost?.getAttribute("data-mermaid-test")).toBe(label);
  });

describe("MermaidPreview", () => {
  beforeEach(() => {
    renderMermaid.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the SVG markup returned by the renderer", async () => {
    renderMermaid.mockResolvedValue(svgFor("first"));
    const { container } = render(<MermaidPreview code="graph TD; A-->B" />);

    // Before the debounce elapses there is only the placeholder.
    expect(container.querySelector("[data-mermaid-svg]")).toBeNull();
    expect(container.textContent).toContain("Rendering diagram…");

    await waitForSvg(container, "first");

    expect(renderMermaid).toHaveBeenCalledTimes(1);
    expect(renderMermaid).toHaveBeenCalledWith("graph TD; A-->B", "default");
    expect(container.querySelector("[data-mermaid-error]")).toBeNull();
    expect(container.textContent).not.toContain("Rendering diagram…");
  });

  it("shows an error message instead of crashing when the renderer rejects", async () => {
    renderMermaid.mockRejectedValue(
      new Error("Parse error on line 3\nunexpected token"),
    );
    const { container } = render(<MermaidPreview code="not a diagram" />);

    await waitFor(() => {
      const error = container.querySelector("[data-mermaid-error]");
      expect(error).not.toBeNull();
      // Single line, no stack.
      expect(error?.textContent).toBe(
        "Parse error on line 3 unexpected token",
      );
    });

    // Root still renders; no diagram is shown for the failed render.
    expect(container.querySelector("[data-mermaid-preview]")).not.toBeNull();
    expect(container.querySelector("[data-mermaid-svg]")).toBeNull();
  });

  it("keeps the last good diagram visible when a later render fails", async () => {
    renderMermaid.mockResolvedValueOnce(svgFor("good"));
    const { container, rerender } = render(
      <MermaidPreview code="graph TD; A-->B" />,
    );
    await waitForSvg(container, "good");

    renderMermaid.mockRejectedValueOnce(new Error("broken"));
    rerender(<MermaidPreview code="graph TD; A-->B; nonsense" />);

    await waitFor(() => {
      expect(container.querySelector("[data-mermaid-error]")?.textContent).toBe(
        "broken",
      );
    });
    // The stale-but-valid diagram stays above the error.
    expect(container.querySelector("[data-mermaid-svg]")).not.toBeNull();
  });

  it("never calls the renderer for whitespace-only code", async () => {
    const { container } = render(<MermaidPreview code={"  \n\t  "} />);

    expect(container.textContent).toContain("Empty diagram");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(renderMermaid).not.toHaveBeenCalled();
    expect(container.querySelector("[data-mermaid-svg]")).toBeNull();
    expect(container.querySelector("[data-mermaid-error]")).toBeNull();
  });

  it("ignores a superseded render result", async () => {
    const first = deferred();
    const second = deferred();
    renderMermaid.mockReturnValueOnce(first.promise);
    renderMermaid.mockReturnValueOnce(second.promise);

    const { container, rerender } = render(<MermaidPreview code="one" />);
    await waitFor(() => expect(renderMermaid).toHaveBeenCalledTimes(1));

    rerender(<MermaidPreview code="two" />);
    await waitFor(() => expect(renderMermaid).toHaveBeenCalledTimes(2));

    // Newer render wins first...
    await act(async () => {
      second.resolve(svgFor("two"));
      await second.promise;
    });
    await waitForSvg(container, "two");

    // ...and the older, slower one settling afterwards must not clobber it.
    await act(async () => {
      first.resolve(svgFor("one"));
      await first.promise;
    });
    expect(
      container
        .querySelector("[data-mermaid-svg] svg[data-mermaid-test]")
        ?.getAttribute("data-mermaid-test"),
    ).toBe("two");
    expect(container.querySelector("[data-mermaid-error]")).toBeNull();
  });

  it("ignores a superseded rejection", async () => {
    const first = deferred();
    const second = deferred();
    renderMermaid.mockReturnValueOnce(first.promise);
    renderMermaid.mockReturnValueOnce(second.promise);

    const { container, rerender } = render(<MermaidPreview code="one" />);
    await waitFor(() => expect(renderMermaid).toHaveBeenCalledTimes(1));

    rerender(<MermaidPreview code="two" />);
    await waitFor(() => expect(renderMermaid).toHaveBeenCalledTimes(2));

    await act(async () => {
      first.reject(new Error("stale failure"));
      // Swallow the handled rejection so the test itself stays clean.
      await first.promise.catch(() => undefined);
    });

    expect(container.querySelector("[data-mermaid-error]")).toBeNull();

    await act(async () => {
      second.resolve(svgFor("two"));
      await second.promise;
    });
    await waitForSvg(container, "two");
  });

  it("passes the requested theme through to the renderer", async () => {
    renderMermaid.mockResolvedValue(svgFor("themed"));
    const { container } = render(
      <MermaidPreview code="graph TD; A-->B" theme="dark" />,
    );

    await waitForSvg(container, "themed");
    expect(renderMermaid).toHaveBeenCalledWith("graph TD; A-->B", "dark");
  });
});