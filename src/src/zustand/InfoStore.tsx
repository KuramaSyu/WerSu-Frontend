import { create } from "zustand";

export interface SnackbarUpdate {
  message: string;
  severity: "success" | "info" | "warning" | "error";
  duration?: number;
  description?: string;
}

export class SnackbarUpdateImpl implements SnackbarUpdate {
  message: string;
  severity: "success" | "info" | "warning" | "error";
  duration?: number;
  description?: string;

  /**
   * @param message Short, primary text shown in the snackbar header.
   * @param severity Controls alert styling and default auto-hide duration.
   * @param duration Optional override in seconds for how long the snackbar stays visible.
   * @param description Optional longer text shown in a collapsible "Details" section.
   */
  constructor(
    message: string,
    severity?: "success" | "info" | "warning" | "error",
    duration?: number,
    description?: string,
  ) {
    this.message = message;
    this.severity = severity ?? "info";
    this.duration = duration ?? this.geDefaultDuration();
    this.description = description;
  }

  getDurationMs(): number {
    return (this.duration ?? this.geDefaultDuration()) * 1000;
  }

  geDefaultDuration(): number {
    if (this.severity === "info") {
      return 1;
    } else if (this.severity === "warning" || this.severity === "error") {
      return 6;
    } else {
      return 1;
    }
  }
}

interface AppState {
  Message: SnackbarUpdateImpl;
  setMessage: (message: SnackbarUpdateImpl) => void;
}

const useInfoStore = create<AppState>((set) => ({
  Message: new SnackbarUpdateImpl(""),
  setMessage: (message) => set({ Message: message }),
}));

export default useInfoStore;
