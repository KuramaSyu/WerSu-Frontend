import type { Editor } from "@tiptap/core";

/**
 * One selectable value for an argument's autocomplete menu.
 *
 * `value` is what the command receives; `label`/`description` are only
 * used for display.
 */
export interface SlashCommandArgumentOption {
  value: string;
  label?: string;
  description?: string;
}

/**
 * Context passed to an argument's autocomplete source.
 *
 * `signal` is aborted when the query changes or the composer closes, so
 * asynchronous sources (e.g. a server search) can cancel stale requests.
 */
export interface SlashCommandAutocompleteContext {
  editor: Editor;
  command: SlashCommand;
  argument: SlashCommandArgument;
  /** The value typed into the argument input so far. */
  query: string;
  /** Values currently entered for the command's other arguments. */
  values: Readonly<Record<string, string>>;
  signal: AbortSignal;
}

/**
 * Autocomplete source for an argument.
 *
 * Either a static list of options or a callback that may be asynchronous.
 * The composer filters the returned options by the typed query, so a
 * server-side source may return all matches without re-filtering.
 */
export type SlashCommandArgumentAutocomplete =
  | readonly SlashCommandArgumentOption[]
  | ((
      context: SlashCommandAutocompleteContext,
    ) =>
      | readonly SlashCommandArgumentOption[]
      | Promise<readonly SlashCommandArgumentOption[]>);

/**
 * Declarative argument for a slash command.
 *
 * Arguments are rendered as chips in the composer: the argument name is
 * shown on the left, its value input on the right. `required` arguments
 * block execution until they have a value (typed or `defaultValue`).
 */
export interface SlashCommandArgument {
  /** Label shown in the composer chip and used as key in `values`. */
  name: string;
  /** Short help text shown above the autocomplete suggestions. */
  description?: string;
  /** Whether the command may run without a value. Defaults to `false`. */
  required?: boolean;
  /**
   * Fallback value used when the user does not type anything. A default
   * value also satisfies `required`.
   */
  defaultValue?: string;
  /**
   * Optional suggestions. When set, the composer opens a dropdown above
   * the argument input while it is focused.
   */
  autocomplete?: SlashCommandArgumentAutocomplete;
  /**
   * Whether the user may type a value that is not in the suggestion list.
   * Defaults to `true`.
   */
  allowCustomValue?: boolean;
}

/** Values passed to `SlashCommand.run` when a command is executed. */
export interface SlashCommandArguments {
  /** Resolved argument values joined by spaces. */
  raw: string;
  /** Resolved argument values in argument declaration order. */
  tokens: string[];
  /** Argument name → resolved value (defaults applied). */
  values: Readonly<Record<string, string>>;
  /** Convenience accessor for one argument value. */
  value: (name: string) => string | undefined;
}

export const EMPTY_SLASH_COMMAND_ARGUMENTS: SlashCommandArguments = {
  raw: "",
  tokens: [],
  values: {},
  value: () => undefined,
};

/**
 * Builds the execution payload from a command's argument declarations and
 * the values typed into the composer.
 *
 * Empty values fall back to `argument.defaultValue`; arguments without
 * either are omitted.
 */
export const createSlashCommandArguments = (
  command: SlashCommand,
  values: Readonly<Record<string, string>>,
  omitted: readonly string[] = [],
): SlashCommandArguments => {
  const resolved: Record<string, string> = {};
  const tokens: string[] = [];

  for (const argument of command.arguments ?? []) {
    if (omitted.includes(argument.name)) {
      continue;
    }
    const typed = values[argument.name]?.trim() ?? "";
    const value = typed || argument.defaultValue?.trim() || "";
    if (value.length === 0) {
      continue;
    }
    resolved[argument.name] = value;
    tokens.push(value);
  }

  if (tokens.length === 0) {
    return EMPTY_SLASH_COMMAND_ARGUMENTS;
  }

  return {
    raw: tokens.join(" "),
    tokens,
    values: Object.freeze(resolved),
    value: (name: string) => resolved[name],
  };
};

/**
 * A slash command shown in the floating menu.
 *
 * Commands are either built into the editor or injected by a parent
 * component (`extraCommands`).
 */
export interface SlashCommand {
  id: string;
  label: string;
  keywords: string[];
  /** Optional command name that reflects the editor's current state. */
  getCommandName?: (editor: Editor) => string;
  /**
   * Arguments rendered in the composer. Commands with at least one
   * argument open the composer on Tab/Enter instead of running directly.
   */
  arguments?: readonly SlashCommandArgument[];
  run: (
    editor: Editor,
    args?: SlashCommandArguments,
  ) => void | Promise<void>;
}