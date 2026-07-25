// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../test/setup";

vi.mock("./MicroInteractionButton", () => ({
  MicroInteractionButton: ({
    onTrigger,
    onClick,
    icon,
    microInteraction,
    disabled,
    "aria-label": ariaLabel,
  }: {
    onTrigger?: () => void | Promise<void>;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    icon: React.ReactNode;
    microInteraction: React.ReactNode;
    disabled?: boolean;
    "aria-label"?: string;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      data-testid="copy-btn"
      data-resting={!!icon}
      data-micro={!!microInteraction}
      onClick={(event) => {
        onClick?.(event);
        void onTrigger?.();
      }}
    >
      <span data-testid="icon-resting">{icon}</span>
      <span data-testid="icon-micro">{microInteraction}</span>
    </button>
  ),
}));

import { CopyButton } from "./CopyButton";

describe("CopyButton", () => {
  it("renders a button with an accessible label and the resting copy icon", () => {
    render(
      <CopyButton
        text="hello"
        aria-label="copy"
        copyFunction={vi.fn().mockResolvedValue(true)}
      />,
    );
    const button = screen.getByTestId("copy-btn");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "copy");
    expect(button.getAttribute("data-resting")).toBe("true");
    expect(button.getAttribute("data-micro")).toBe("true");
  });

  it("calls the seam with the supplied text on click", async () => {
    const copyFunction = vi.fn().mockResolvedValue(true);
    render(
      <CopyButton
        text="the payload"
        aria-label="copy"
        copyFunction={copyFunction}
      />,
    );
    fireEvent.click(screen.getByTestId("copy-btn"));

    await waitFor(() =>
      expect(copyFunction).toHaveBeenCalledWith("the payload"),
    );
  });

  it("prefers onCopy over the seam when both are supplied", async () => {
    const copyFunction = vi.fn().mockResolvedValue(true);
    const onCopy = vi.fn().mockResolvedValue(true);
    render(
      <CopyButton
        text="delegated"
        aria-label="copy"
        copyFunction={copyFunction}
        onCopy={onCopy}
      />,
    );
    fireEvent.click(screen.getByTestId("copy-btn"));

    await waitFor(() => expect(onCopy).toHaveBeenCalledWith("delegated"));
    expect(copyFunction).not.toHaveBeenCalled();
  });

  it("disables the button when text is empty and no onCopy is supplied", () => {
    render(
      <CopyButton
        text=""
        aria-label="copy"
        copyFunction={vi.fn().mockResolvedValue(true)}
      />,
    );
    expect(screen.getByTestId("copy-btn")).toBeDisabled();
  });

  it("does not disable the button when a custom onCopy is supplied, even with empty text", () => {
    const onCopy = vi.fn();
    render(
      <CopyButton
        text=""
        aria-label="copy"
        onCopy={onCopy}
        copyFunction={vi.fn().mockResolvedValue(true)}
      />,
    );
    expect(screen.getByTestId("copy-btn")).not.toBeDisabled();
  });

  it("respects an explicit disabled prop", () => {
    render(
      <CopyButton
        text="hi"
        aria-label="copy"
        disabled
        copyFunction={vi.fn().mockResolvedValue(true)}
      />,
    );
    expect(screen.getByTestId("copy-btn")).toBeDisabled();
  });
});
