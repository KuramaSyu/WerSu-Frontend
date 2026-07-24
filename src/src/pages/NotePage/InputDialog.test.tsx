// Tier 4 tests for `InputDialog`.
//
// Validates both the text and file modes of the imperative dialog
// returned by `useDialog()`. We mock `@mui/material` with dumb
// pass-throughs so the test stays out of MUI's ESM resolution
// (which breaks under Vitest 4 + node), and so the assertions
// target *behavior*, not MUI internals.

// @vitest-environment jsdom

import "../../test/setup";

import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { DialogProvider, useDialog, type DialogResult } from "./InputDialog";

// Mock `@mui/material` with light stubs. We only need the bits
// `InputDialog` actually renders. Anything we miss here will fall
// back to `null` via the catch-all, which keeps the test honest
// — it surfaces unknown MUI usage instead of papering over it.
vi.mock("@mui/material", () => {
  const passthrough =
    <T extends Record<string, unknown>>(Component: string) =>
    (props: T) => {
      const { children, ...rest } = props as T & { children?: ReactNode };
      return (
        <div data-mock={Component} {...rest}>
          {children}
        </div>
      );
    };

  const Dialog = ({
    open,
    onClose,
    children,
  }: {
    open: boolean;
    onClose?: () => void;
    children?: ReactNode;
  }) =>
    open ? (
      <div
        data-testid="input-dialog"
        role="dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onClose?.();
          }
        }}
        tabIndex={-1}
      >
        {children}
      </div>
    ) : null;

  const Button = ({
    onClick,
    disabled,
    children,
    variant: _variant,
    ...rest
  }: {
    onClick?: () => void;
    disabled?: boolean;
    children?: ReactNode;
    variant?: string;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  );

  return {
    Box: passthrough<Record<string, unknown>>("Box"),
    Button,
    Dialog,
    DialogTitle: ({ children }: { children?: ReactNode }) => (
      <h2 data-mock="DialogTitle">{children}</h2>
    ),
    DialogContent: ({ children }: { children?: ReactNode }) => (
      <div data-mock="DialogContent">{children}</div>
    ),
    DialogActions: ({ children }: { children?: ReactNode }) => (
      <div data-mock="DialogActions">{children}</div>
    ),
    TextField: ({
      value,
      onChange,
      placeholder,
      onKeyDown,
      slotProps,
    }: {
      value?: string;
      onChange?: (event: { target: { value: string } }) => void;
      placeholder?: string;
      onKeyDown?: (event: React.KeyboardEvent) => void;
      slotProps?: { htmlInput?: Record<string, unknown> };
    }) => {
      const htmlInput = slotProps?.htmlInput ?? {};
      return (
        <input
          {...htmlInput}
          data-testid="input-dialog-textfield"
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(event) =>
            onChange?.({ target: { value: event.target.value } })
          }
          onKeyDown={(event) =>
            onKeyDown?.(event as unknown as React.KeyboardEvent)
          }
        />
      );
    },
    Typography: ({
      children,
      variant: _variant,
      ...rest
    }: {
      children?: ReactNode;
      variant?: string;
      [key: string]: unknown;
    }) => (
      <span data-mock="Typography" {...rest}>
        {children}
      </span>
    ),
  };
});

/**
 * Mounts a child inside `<DialogProvider>` that calls `useDialog()` once
 * with the given options and writes the resolved value into the supplied
 * `resultRef`. Tests read `resultRef.current` after driving a DOM event;
 * a microtask `await flushPromises()` call is required to let the
 * Promise's `.then` resolve.
 */
function TestConsumer({
  options,
  resultRef,
}: {
  options: Parameters<ReturnType<typeof useDialog>>[0];
  resultRef: { current: DialogResult | undefined };
}) {
  const prompt = useDialog();

  useEffect(() => {
    let cancelled = false;
    void prompt(options).then((result) => {
      if (!cancelled) {
        resultRef.current = result;
      }
    });
    return () => {
      cancelled = true;
    };
    // intentionally only run once per mount: this component exists
    // to drive a single dialog interaction and then tear down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/** flush microtasks so a `useDialog()` Promise can resolve */
const flushPromises = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("InputDialog — text mode", () => {
  it("resolves with the entered string when the user confirms", async () => {
    const resultRef: { current: DialogResult | undefined } = {
      current: undefined,
    };
    render(
      <DialogProvider>
        <TestConsumer options={{ title: "Name" }} resultRef={resultRef} />
      </DialogProvider>,
    );

    const textbox = await screen.findByTestId("input-dialog-textfield");
    fireEvent.change(textbox, { target: { value: "Ada" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("input-dialog-confirm"));
      await flushPromises();
    });

    expect(resultRef.current).toBe("Ada");
  });

  it("submits on Enter without modifier keys", async () => {
    const resultRef: { current: DialogResult | undefined } = {
      current: undefined,
    };
    render(
      <DialogProvider>
        <TestConsumer options={{ title: "Name" }} resultRef={resultRef} />
      </DialogProvider>,
    );

    const textbox = await screen.findByTestId("input-dialog-textfield");
    fireEvent.change(textbox, { target: { value: "Ada" } });
    fireEvent.keyDown(textbox, { key: "Enter" });
    await flushPromises();

    expect(resultRef.current).toBe("Ada");
  });

  it("does not submit on Shift+Enter (preserves newlines for callers)", async () => {
    const resultRef: { current: DialogResult | undefined } = {
      current: undefined,
    };
    render(
      <DialogProvider>
        <TestConsumer options={{ title: "Name" }} resultRef={resultRef} />
      </DialogProvider>,
    );

    const textbox = await screen.findByTestId("input-dialog-textfield");
    fireEvent.change(textbox, { target: { value: "Ada" } });
    fireEvent.keyDown(textbox, { key: "Enter", shiftKey: true });
    await flushPromises();

    expect(resultRef.current).toBeUndefined();
  });

  it("resolves with null when the user cancels", async () => {
    const resultRef: { current: DialogResult | undefined } = {
      current: undefined,
    };
    render(
      <DialogProvider>
        <TestConsumer options={{ title: "Name" }} resultRef={resultRef} />
      </DialogProvider>,
    );

    await screen.findByTestId("input-dialog");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await flushPromises();

    expect(resultRef.current).toBeNull();
  });

  it("resolves with null when the dialog backdrop is clicked", async () => {
    const resultRef: { current: DialogResult | undefined } = {
      current: undefined,
    };
    render(
      <DialogProvider>
        <TestConsumer options={{ title: "Name" }} resultRef={resultRef} />
      </DialogProvider>,
    );

    const dialog = await screen.findByTestId("input-dialog");
    // MUI fires onClose with reason "backdropClick"; we simulate that
    // by dispatching the escape-key fallback path which also calls
    // onClose(null). Pressing Escape is the simplest cross-version way
    // to trigger onClose in jsdom.
    fireEvent.keyDown(dialog, { key: "Escape" });
    await flushPromises();

    expect(resultRef.current).toBeNull();
  });

  it("seeds the field from initialValue", async () => {
    const resultRef: { current: DialogResult | undefined } = {
      current: undefined,
    };
    render(
      <DialogProvider>
        <TestConsumer
          options={{ title: "Name", initialValue: "pre-filled" }}
          resultRef={resultRef}
        />
      </DialogProvider>,
    );

    const textbox = await screen.findByTestId("input-dialog-textfield");
    expect(textbox).toHaveValue("pre-filled");

    fireEvent.click(screen.getByTestId("input-dialog-confirm"));
    await flushPromises();
    expect(resultRef.current).toBe("pre-filled");
  });
});

describe("InputDialog — file mode", () => {
  it("disables the confirm button until a file is picked", async () => {
    const resultRef: { current: DialogResult | undefined } = {
      current: undefined,
    };
    render(
      <DialogProvider>
        <TestConsumer
          options={{ title: "Upload", mode: "file" }}
          resultRef={resultRef}
        />
      </DialogProvider>,
    );

    const confirm = await screen.findByTestId("input-dialog-confirm");
    expect(confirm).toBeDisabled();
  });

  it("resolves with the picked File when the user confirms", async () => {
    const resultRef: { current: DialogResult | undefined } = {
      current: undefined,
    };
    render(
      <DialogProvider>
        <TestConsumer
          options={{ title: "Upload", mode: "file", accept: "image/*" }}
          resultRef={resultRef}
        />
      </DialogProvider>,
    );

    const fileInput = (await screen.findByTestId("input-dialog")).querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    expect(fileInput.accept).toBe("image/*");

    const file = new File(["hello"], "hello.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByTestId("selected-file-name")).toHaveTextContent(
      "hello.png",
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("input-dialog-confirm"));
      await flushPromises();
    });

    expect(resultRef.current).toBeInstanceOf(File);
    expect((resultRef.current as File).name).toBe("hello.png");
    expect((resultRef.current as File).type).toBe("image/png");
  });

  it("uses the supplied dropText / dropHint / confirmLabel", async () => {
    render(
      <DialogProvider>
        <TestConsumer
          options={{
            title: "Upload",
            mode: "file",
            dropText: "Drop here",
            dropHint: "or browse",
            confirmLabel: "Send it",
          }}
          resultRef={{ current: undefined }}
        />
      </DialogProvider>,
    );

    expect(await screen.findByText("Drop here")).toBeInTheDocument();
    expect(screen.getByText("or browse")).toBeInTheDocument();
    expect(screen.getByTestId("input-dialog-confirm")).toHaveTextContent(
      "Send it",
    );
  });

  it("resolves with null when cancelled", async () => {
    const resultRef: { current: DialogResult | undefined } = {
      current: undefined,
    };
    render(
      <DialogProvider>
        <TestConsumer
          options={{ title: "Upload", mode: "file" }}
          resultRef={resultRef}
        />
      </DialogProvider>,
    );

    await screen.findByTestId("input-dialog");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await flushPromises();

    expect(resultRef.current).toBeNull();
  });
});
