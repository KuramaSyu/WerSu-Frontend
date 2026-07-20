// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock(import("../zustand/InfoStore"), async (importOriginal) => {
  const actual = await importOriginal<typeof import("../zustand/InfoStore")>();
  const realStore = actual.default;
  return {
    ...actual,
    useInfoStore: realStore,
    default: realStore,
    copyToClipboard: vi.fn(),
  };
});

import { CopyButton } from "./CopyButton";
import useInfoStore, {
  copyToClipboard,
  SnackbarUpdateImpl,
} from "../zustand/InfoStore";

const mockedCopy = vi.mocked(copyToClipboard);

describe("CopyButton", () => {
  beforeEach(() => {
    mockedCopy.mockReset();
    useInfoStore.setState({
      logs: [],
      Message: new SnackbarUpdateImpl(""),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a button with an accessible label and the resting copy icon", () => {
    render(<CopyButton text="hello" aria-label="copy" />);
    const button = screen.getByTestId("copy-btn");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "copy");
    expect(button.getAttribute("data-resting")).toBe("true");
    expect(button.getAttribute("data-micro")).toBe("true");
  });

  it("copies the supplied text and pushes a success snackbar on click", async () => {
    mockedCopy.mockResolvedValue(true);

    render(<CopyButton text="the payload" aria-label="copy" />);
    fireEvent.click(screen.getByTestId("copy-btn"));

    await waitFor(() => {
      expect(mockedCopy).toHaveBeenCalledWith("the payload");
    });

    const { Message } = useInfoStore.getState();
    expect(Message.message).toBe("Copied to clipboard");
    expect(Message.severity).toBe("success");
  });

  it("pushes a failure snackbar when copyToClipboard returns false", async () => {
    mockedCopy.mockResolvedValue(false);

    render(<CopyButton text="oops" aria-label="copy" />);
    fireEvent.click(screen.getByTestId("copy-btn"));

    await waitFor(() => {
      expect(useInfoStore.getState().Message.message).toBe("Copy failed");
    });
    expect(useInfoStore.getState().Message.severity).toBe("error");
  });

  it("uses the custom onCopy handler and still toasts by default", async () => {
    const onCopy = vi.fn().mockResolvedValue(true);

    render(
      <CopyButton
        text="delegated"
        aria-label="copy"
        onCopy={onCopy}
        successMessage="URL copied"
      />,
    );
    fireEvent.click(screen.getByTestId("copy-btn"));

    await waitFor(() => expect(onCopy).toHaveBeenCalledWith("delegated"));
    expect(mockedCopy).not.toHaveBeenCalled();

    const { Message } = useInfoStore.getState();
    expect(Message.message).toBe("URL copied");
    expect(Message.severity).toBe("success");
  });

  it("does not push a snackbar when showToast is false", async () => {
    const onCopy = vi.fn().mockResolvedValue(true);
    const before = useInfoStore.getState().Message;

    render(
      <CopyButton
        text="quiet"
        aria-label="copy"
        onCopy={onCopy}
        showToast={false}
      />,
    );
    fireEvent.click(screen.getByTestId("copy-btn"));

    await waitFor(() => expect(onCopy).toHaveBeenCalled());
    expect(useInfoStore.getState().Message).toBe(before);
  });

  it("disables the button when text is empty and no onCopy is supplied", () => {
    render(<CopyButton text="" aria-label="copy" />);
    expect(screen.getByTestId("copy-btn")).toBeDisabled();
  });

  it("does not disable the button when a custom onCopy is supplied, even with empty text", () => {
    const onCopy = vi.fn();
    render(<CopyButton text="" aria-label="copy" onCopy={onCopy} />);
    expect(screen.getByTestId("copy-btn")).not.toBeDisabled();
  });

  it("respects an explicit disabled prop", () => {
    render(<CopyButton text="hi" aria-label="copy" disabled />);
    expect(screen.getByTestId("copy-btn")).toBeDisabled();
  });
});
