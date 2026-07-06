import type {
  AccessedAs,
  ActivityKind,
  HistoryFilter,
  MostUsedAlgorithm,
} from "../models/history";

/**
 * Fluent constructor for :class:`HistoryFilter`.
 *
 * Mirrors the Python `ActivityFilterBuilder`. Pick a mode first
 * (`useHistory()` or `showMostUsed()`), layer filters, then call
 * `build()` to get the immutable shape the API client sends.
 *
 * Examples
 * --------
 * History of note X for the last 30 days, paginated::
 *
 *     new HistoryFilterBuilder()
 *       .useHistory()
 *       .setNote(noteId)
 *       .setDays(30)
 *       .setLimit(50)
 *       .build();
 *
 * Most-viewed notes in a directory, last 30 days, log-flattened,
 * one count per actor per day::
 *
 *     new HistoryFilterBuilder()
 *       .showMostUsed()
 *       .withAlgorithm("MOST_USED_ALGORITHM_LOG_COUNT")
 *       .uniquePerDay()
 *       .setDirectory(directoryId)
 *       .setDays(30)
 *       .build();
 *
 * Notes
 * -----
 * `setAccessedAs()` defaults to `ACCESSED_AS_USER`. Pass an
 * explicit value to filter on `ACCESSED_AS_SYSTEM` (or
 * `ACCESSED_AS_UNSPECIFIED` to disable the filter).
 *
 * For `most_used` mode, `algorithm` defaults to
 * `MOST_USED_ALGORITHM_COUNT` when `withAlgorithm()` is not called.
 *
 * `uniquePerDay()` only applies to `most_used` mode; setting it in
 * `history` mode raises on `build()`.
 */
export class HistoryFilterBuilder {
  private _filter: HistoryFilter = {};

  /** Switch to plain reverse-chronological list mode. */
  useHistory(): HistoryFilterBuilder {
    this._filter = { ...this._filter, mode: "history" };
    return this;
  }

  /** Switch to aggregated most-used ranking mode. */
  showMostUsed(): HistoryFilterBuilder {
    this._filter = { ...this._filter, mode: "most_used" };
    return this;
  }

  /** Restrict to a single note. Replaces any prior note id. */
  setNote(noteId: string): HistoryFilterBuilder {
    this._filter = { ...this._filter, note_id: noteId };
    return this;
  }

  /**
   * Restrict to a directory subtree root.
   *
   * Currently the wire accepts a single `directory_id`; calling
   * `setDirectory` twice REPLACES the prior id. If multi-subtree
   * filtering is added to the wire later, this can switch to
   * append.
   */
  setDirectory(directoryId: string): HistoryFilterBuilder {
    this._filter = { ...this._filter, directory_id: directoryId };
    return this;
  }

  /** Restrict to events performed by `userId`. */
  setUser(userId: string): HistoryFilterBuilder {
    this._filter = { ...this._filter, actor_id: userId };
    return this;
  }

  /**
   * Restrict to events whose actor was acting as `accessedAs`.
   * Defaults to `ACCESSED_AS_USER`. Pass
   * `ACCESSED_AS_UNSPECIFIED` to disable the filter.
   */
  setAccessedAs(
    accessedAs: AccessedAs = "ACCESSED_AS_USER",
  ): HistoryFilterBuilder {
    this._filter = { ...this._filter, accessed_as: accessedAs };
    return this;
  }

  /** Restrict to events affecting the role with `roleId`. */
  setRoleId(roleId: string): HistoryFilterBuilder {
    this._filter = { ...this._filter, role_id: roleId };
    return this;
  }

  /** Restrict to a single action kind. Replaces any prior actions. */
  setAction(action: ActivityKind): HistoryFilterBuilder {
    this._filter = { ...this._filter, actions: [action] };
    return this;
  }

  /**
   * Restrict to any of the given action kinds. The wire sends these
   * as a repeated `actions=` query parameter; the repo applies
   * `action = ANY(...)`.
   */
  setActionSet(...actions: ActivityKind[]): HistoryFilterBuilder {
    this._filter = { ...this._filter, actions: [...actions] };
    return this;
  }

  /** Restrict to events within the last `days` days. */
  setDays(days: number): HistoryFilterBuilder {
    this._filter = { ...this._filter, days };
    return this;
  }

  /** Cap the number of returned rows. */
  setLimit(limit: number): HistoryFilterBuilder {
    this._filter = { ...this._filter, limit };
    return this;
  }

  /** Skip the first `offset` rows. */
  setOffset(offset: number): HistoryFilterBuilder {
    this._filter = { ...this._filter, offset };
    return this;
  }

  /** Pick the scoring algorithm for `most_used` mode. */
  withAlgorithm(algorithm: MostUsedAlgorithm): HistoryFilterBuilder {
    this._filter = { ...this._filter, algorithm };
    return this;
  }

  /**
   * Collapse repeats to one count per actor per day before
   * aggregating. Only meaningful in `most_used` mode.
   */
  uniquePerDay(value: boolean = true): HistoryFilterBuilder {
    this._filter = { ...this._filter, unique_per_day: value };
    return this;
  }

  /**
   * Validate the accumulated filter and return it.
   *
   * @throws Error if `mode` was never set, if `algorithm` /
   *   `unique_per_day` were set without `most_used` mode, or if
   *   `days` is non-positive.
   */
  build(): HistoryFilter {
    const f = this._filter;
    if (f.mode === undefined) {
      throw new Error(
        "HistoryFilterBuilder: call useHistory() or showMostUsed() first",
      );
    }
    if (f.algorithm !== undefined && f.mode !== "most_used") {
      throw new Error(
        "HistoryFilterBuilder: withAlgorithm() requires showMostUsed()",
      );
    }
    if (f.unique_per_day !== undefined && f.mode !== "most_used") {
      throw new Error(
        "HistoryFilterBuilder: uniquePerDay() requires showMostUsed()",
      );
    }
    if (f.days !== undefined && (!Number.isInteger(f.days) || f.days <= 0)) {
      throw new Error("HistoryFilterBuilder: days must be a positive integer");
    }
    return f;
  }
}
