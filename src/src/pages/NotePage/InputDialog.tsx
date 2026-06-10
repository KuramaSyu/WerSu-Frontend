import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@mui/material";
import { createContext, useContext, useState } from "react";

type Resolver = (value: string | null) => void;

const DialogContext = createContext<
  (options: { title: string }) => Promise<string | null>
>(() => Promise.resolve(null));

export function DialogProvider({ children }: React.PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [resolver, setResolver] = useState<Resolver | null>(null);

  const openDialog = (options: { title: string }) => {
    setTitle(title);
    setValue("");
    setOpen(true);

    // ????
    return new Promise<string | null>((resolve) => {
      setResolver(() => resolve);
    });
  };

  /**
   * closes the dialog and resolves the promise (e.g. returning from await) with result. In case of cancellation, result is null.
   * @param result the value what the user entered into the dialog
   */
  const close = (result: string | null) => {
    setOpen(false);
    resolver?.(result);
  };

  return (
    <DialogContext.Provider value={openDialog}>
      {children}

      <Dialog open={open} onClose={() => close(null)}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>"test"</DialogContent>
        <DialogActions>
          <IconButton onClick={() => close(value)}>ok</IconButton>
          <IconButton onClick={() => close(null)}>Cancel</IconButton>
        </DialogActions>
      </Dialog>
    </DialogContext.Provider>
  );
}

/**
 * an async way to ask the user for input and await it
 * @usage ```ts
 * const dialog = useDialog({
 *   title: "Enter your name"
 * })
 * const name = await dialog();
 * ```
 */
export const useDialog = () => useContext(DialogContext);
