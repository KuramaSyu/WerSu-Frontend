// -------------------------------------------------------------------------
// Note save state machine
//
// The Save control has five states (notSavable / idle / saving / saved /
// failed) and only a small set of allowed transitions. Keeping that logic
// in state objects avoids scattering `if (saveStatus === ...)` branches
// across the store and toolbar.
//
// The state objects receive the machine as their context. A state can
// therefore initiate the next transition itself (for example SavingState
// waits out the minimum display window and then moves to SavedState or
// FailedState).
// -------------------------------------------------------------------------

export type NoteSaveStatus =
  | "notSavable"
  | "idle"
  | "saving"
  | "saved"
  | "failed";

/** Keep "Saving" visible even when the request resolves immediately. */
export const MIN_SAVING_DISPLAY_MS = 500;

/** How long "Saved now" stays active before returning to idle. */
export const SAVED_STATUS_DURATION_MS = 4_000;

export interface NoteSaveContext {
  now(): number;
  minSavingMs: number;
  savedDurationMs: number;
  transitionTo(next: NoteSaveState): void;
  /** Transition only if `current` is still the active state. */
  transitionFrom(current: NoteSaveState, next: NoteSaveState): void;
  setTimer(callback: () => void, delayMs: number): void;
}

export interface NoteSaveState {
  readonly status: NoteSaveStatus;
  /** Entered as the active state; may schedule a future transition. */
  enter?(context: NoteSaveContext): void;
  /** @returns true when a save may start from this state. */
  start(context: NoteSaveContext): boolean;
  succeed(context: NoteSaveContext): Promise<void>;
  fail(context: NoteSaveContext): Promise<void>;
  /** The note gained local changes. */
  markDirty(context: NoteSaveContext): void;
  /** The note has no local changes left (e.g. draft cleared). */
  markClean(context: NoteSaveContext): void;
  reset(context: NoteSaveContext): void;
}

/** Shared no-op behavior for transitions a state does not participate in. */
abstract class BaseSaveState implements NoteSaveState {
  abstract readonly status: NoteSaveStatus;

  /** States that can start a save override this. */
  start(context: NoteSaveContext): boolean {
    void context;
    return false;
  }

  succeed(context: NoteSaveContext): Promise<void> {
    void context;
    return Promise.resolve();
  }

  fail(context: NoteSaveContext): Promise<void> {
    void context;
    return Promise.resolve();
  }

  markDirty(context: NoteSaveContext): void {
    context.transitionTo(new IdleState());
  }

  markClean(context: NoteSaveContext): void {
    context.transitionTo(new NotSavableState());
  }

  reset(context: NoteSaveContext): void {
    context.transitionTo(new NotSavableState());
  }
}

export class NotSavableState extends BaseSaveState {
  readonly status = "notSavable" as const;

  markClean(): void {
    // Already clean.
  }

  reset(): void {
    // Already in the reset state.
  }
}

export class IdleState extends BaseSaveState {
  readonly status = "idle" as const;

  start(context: NoteSaveContext): boolean {
    context.transitionTo(new SavingState(context.now()));
    return true;
  }

  markDirty(): void {
    // Already savable.
  }

  reset(context: NoteSaveContext): void {
    context.transitionTo(new NotSavableState());
  }
}

export class SavingState extends BaseSaveState {
  readonly status = "saving" as const;

  constructor(private readonly startedAt: number) {
    super();
  }

  start(): boolean {
    // A save is already in flight.
    return false;
  }

  succeed(context: NoteSaveContext): Promise<void> {
    return this.settle(context, new SavedState());
  }

  fail(context: NoteSaveContext): Promise<void> {
    return this.settle(context, new FailedState());
  }

  markDirty(): void {
    // The in-flight save already covers the active note.
  }

  markClean(): void {
    // Wait for succeed/fail to choose the next state.
  }

  reset(context: NoteSaveContext): void {
    context.transitionTo(new NotSavableState());
  }

  /**
   * The minimum "Saving" window is measured from when the request
   * started, so a fast response does not make the label flash by.
   */
  private async settle(
    context: NoteSaveContext,
    next: NoteSaveState,
  ): Promise<void> {
    const elapsed = context.now() - this.startedAt;
    const remaining = Math.max(0, context.minSavingMs - elapsed);
    if (remaining > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, remaining);
      });
    }
    context.transitionFrom(this, next);
  }
}

export class SavedState extends BaseSaveState {
  readonly status = "saved" as const;

  enter(context: NoteSaveContext): void {
    context.setTimer(
      () => context.transitionFrom(this, new NotSavableState()),
      context.savedDurationMs,
    );
  }

  markClean(): void {
    // Stay in the "Saved now" window even though the draft is gone.
  }

  start(context: NoteSaveContext): boolean {
    // A tick/multiple ticks can start another save even during the
    // "Saved now" window, so success -> saving is a valid transition.
    context.transitionTo(new SavingState(context.now()));
    return true;
  }
}

export class FailedState extends BaseSaveState {
  readonly status = "failed" as const;

  start(context: NoteSaveContext): boolean {
    context.transitionTo(new SavingState(context.now()));
    return true;
  }

  markDirty(): void {
    // Keep the failure visible until the user retries.
  }

  markClean(): void {
    // Keep the failure visible until the next save attempt.
  }
}

export interface NoteSaveMachineOptions {
  onStatusChange?: (status: NoteSaveStatus) => void;
  now?: () => number;
  minSavingMs?: number;
  savedDurationMs?: number;
}

/**
 * Context for the save states. The store owns one machine per active note
 * and forwards its status changes into the zustand `saveStatus` field.
 */
export class NoteSaveMachine implements NoteSaveContext {
  private state: NoteSaveState = new NotSavableState();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly onStatusChange?: (status: NoteSaveStatus) => void;
  private readonly clock: () => number;

  readonly minSavingMs: number;
  readonly savedDurationMs: number;

  constructor(options: NoteSaveMachineOptions = {}) {
    this.onStatusChange = options.onStatusChange;
    this.clock = options.now ?? (() => Date.now());
    this.minSavingMs = options.minSavingMs ?? MIN_SAVING_DISPLAY_MS;
    this.savedDurationMs =
      options.savedDurationMs ?? SAVED_STATUS_DURATION_MS;
  }

  get status(): NoteSaveStatus {
    return this.state.status;
  }

  now(): number {
    return this.clock();
  }

  /** @returns false when the active state has nothing to save. */
  start(): boolean {
    return this.state.start(this);
  }

  succeed(): Promise<void> {
    return this.state.succeed(this);
  }

  fail(): Promise<void> {
    return this.state.fail(this);
  }

  markDirty(): void {
    this.state.markDirty(this);
  }

  markClean(): void {
    this.state.markClean(this);
  }

  reset(): void {
    this.clearTimer();
    if (this.state.status === "notSavable") {
      return;
    }
    this.transitionTo(new NotSavableState());
  }

  transitionTo(next: NoteSaveState): void {
    this.clearTimer();
    this.state = next;
    this.onStatusChange?.(next.status);
    next.enter?.(this);
  }

  transitionFrom(current: NoteSaveState, next: NoteSaveState): void {
    if (this.state !== current) {
      return;
    }
    this.transitionTo(next);
  }

  setTimer(callback: () => void, delayMs: number): void {
    this.clearTimer();
    this.timer = setTimeout(callback, delayMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
