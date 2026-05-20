export class NavigationMemento {
  private history: string[] = [];
  private index = -1;
  private skipNext = false;

  /**
   * Records a new path into the history, trimming any forward states.
   * This models the Memento pattern where each path is a snapshot.
   */
  record(path: string): void {
    if (this.skipNext) {
      this.skipNext = false;
      return;
    }

    if (this.history[this.index] === path) {
      return;
    }

    if (this.index < this.history.length - 1) {
      this.history = this.history.slice(0, this.index + 1);
    }

    this.history.push(path);
    this.index = this.history.length - 1;
  }

  canUndo(): boolean {
    return this.index > 0;
  }

  canRedo(): boolean {
    return this.index >= 0 && this.index < this.history.length - 1;
  }

  undo(): string | null {
    if (!this.canUndo()) {
      return null;
    }

    this.index -= 1;
    return this.history[this.index] ?? null;
  }

  redo(): string | null {
    if (!this.canRedo()) {
      return null;
    }

    this.index += 1;
    return this.history[this.index] ?? null;
  }

  getCurrent(): string | null {
    return this.history[this.index] ?? null;
  }

  /**
   * Skips recording the next path change. Useful when navigating via
   * undo/redo so we don't create a duplicate entry.
   */
  skipNextRecord(): void {
    this.skipNext = true;
  }
}

export const navigationMemento = new NavigationMemento();

export const recordNavigation = (path: string): void => {
  navigationMemento.record(path);
};
