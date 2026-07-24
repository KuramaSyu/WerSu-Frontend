import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type PropsWithChildren,
} from "react";

/**
 * Result of a successful dialog interaction.
 *
 * - `string` when the dialog ran in `text` mode and the user confirmed.
 * - `File` when the dialog ran in `file` mode and the user picked a file.
 * - `null` when the user cancelled (closed backdrop, pressed Escape, or hit Cancel).
 */
export type DialogResult = string | File | null;

export type DialogMode = "text" | "file";

/**
 * Options accepted by the imperative dialog returned by `useDialog()`.
 *
 * Use `mode: "text"` for single-line prompts (default) and `mode: "file"`
 * for a drag-and-drop file picker that returns a `File`.
 */
export interface DialogOptions {
  title: string;
  /** Defaults to `"text"`. `"file"` renders a drag/drop upload zone. */
  mode?: DialogMode;
  /** Placeholder shown in the text input (text mode only). */
  placeholder?: string;
  /** Pre-filled value (text mode only). */
  initialValue?: string;
  /**
   * `accept` attribute for the hidden `<input type="file">` in file mode
   * (e.g. `"image/*"` or `"image/png,image/jpeg"`).
   */
  accept?: string;
  /** Headline shown inside the drop zone (file mode only). */
  dropText?: string;
  /** Secondary line shown inside the drop zone (file mode only). */
  dropHint?: string;
  /** Label of the confirm button. Defaults to `"OK"` / `"Upload"`. */
  confirmLabel?: string;
}

type Resolver = (value: DialogResult) => void;

type OpenDialog = (options: DialogOptions) => Promise<DialogResult>;

const DialogContext = createContext<OpenDialog>(() => Promise.resolve(null));

const FileDropZone: React.FC<{
  accept?: string;
  dropText: string;
  dropHint: string;
  selected: File | null;
  onSelect: (file: File | null) => void;
}> = ({ accept, dropText, dropHint, selected, onSelect }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    if (file) {
      onSelect(file);
    }
  };

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      sx={{
        mt: 1,
        p: 4,
        border: "2px dashed",
        borderColor: dragging ? "primary.main" : "divider",
        borderRadius: 2,
        textAlign: "center",
        cursor: "pointer",
        transition: "all .2s",
      }}
    >
      <Typography variant="h6">{dropText}</Typography>
      <Typography variant="body2" color="textSecondary">
        {dropHint}
      </Typography>
      {selected && (
        <Typography sx={{ mt: 2 }} data-testid="selected-file-name">
          {selected.name}
        </Typography>
      )}
      <input
        ref={inputRef}
        hidden
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          if (file) {
            onSelect(file);
          }
        }}
      />
    </Box>
  );
};

/**
 * Mounts the imperative dialog used by `useDialog()`. Wrap any subtree
 * that needs to call `useDialog()` — the provider renders a single
 * `<Dialog />` and resolves a promise per invocation, so multiple
 * consumers in the same tree reuse the same surface.
 */
export function DialogProvider({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<DialogOptions>({ title: "" });
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [resolver, setResolver] = useState<Resolver | null>(null);

  const openDialog: OpenDialog = (opts) => {
    setOptions(opts);
    setValue(opts.initialValue ?? "");
    setFile(null);
    setOpen(true);
    return new Promise<DialogResult>((resolve) => {
      setResolver(() => resolve);
    });
  };

  /**
   * closes the dialog and resolves the promise (e.g. returning from await) with result.
   * In case of cancellation, result is null.
   * @param result the value the user entered into the dialog
   */
  const close = (result: DialogResult) => {
    setOpen(false);
    resolver?.(result);
    // clear after microtask so React's batching doesn't drop the resolver
    queueMicrotask(() => setResolver(null));
  };

  // reset transient state when the dialog re-opens for a different prompt
  useEffect(() => {
    if (open) {
      setValue(options.initialValue ?? "");
      setFile(null);
    }
  }, [open, options]);

  const mode = options.mode ?? "text";
  const confirmLabel =
    options.confirmLabel ?? (mode === "file" ? "Upload" : "OK");
  const canConfirm = mode === "file" ? file !== null : true;

  return (
    <DialogContext.Provider value={openDialog}>
      {children}
      <Dialog
        open={open}
        onClose={() => close(null)}
        maxWidth="sm"
        fullWidth
        data-testid="input-dialog"
      >
        <DialogTitle>{options.title}</DialogTitle>
        <DialogContent>
          {mode === "file" ? (
            <FileDropZone
              accept={options.accept}
              dropText={options.dropText ?? "Drag a file here"}
              dropHint={options.dropHint ?? "or click to browse"}
              selected={file}
              onSelect={setFile}
            />
          ) : (
            <TextField
              autoFocus
              fullWidth
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={options.placeholder}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  close(value);
                }
              }}
              slotProps={{
                htmlInput: { "data-testid": "input-dialog-textfield" },
              }}
              sx={{ mt: 1 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => close(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!canConfirm}
            onClick={() => close(mode === "file" ? file : value)}
            data-testid="input-dialog-confirm"
          >
            {confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </DialogContext.Provider>
  );
}

/**
 * Imperatively open a prompt dialog and await the user's response.
 *
 * @example
 * ```ts
 * const prompt = useDialog();
 * const name = await prompt({ title: "Enter your name" });
 * if (name === null) return; // user cancelled
 * ```
 *
 * @example
 * ```ts
 * // file upload
 * const file = await prompt({
 *   title: "Upload Image",
 *   mode: "file",
 *   accept: "image/*",
 * });
 * if (file instanceof File) { ... }
 * ```
 */
export const useDialog = (): OpenDialog => useContext(DialogContext);
