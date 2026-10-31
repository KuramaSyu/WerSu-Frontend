// Slash-command model for the global search overlay.
//
// The search input doubles as a tiny command palette: when its value
// starts with "/", we offer command suggestions. Typing "/context" or
// "/mode context" switches the active search strategy, then the input
// is cleared so the user can immediately type their query without
// reaching for the strategy toggle.
//
// This module is intentionally free of React so the parsing /
// suggestion rules can be unit-tested in isolation.

import { RestNotesSearchType } from "../../../api/models/search";

/** A search strategy that can be selected by name. */
export interface SearchModeOption {
  /** Token typed after `/mode`, e.g. `context`. */
  value: string;
  /** Human label shown in suggestions, e.g. `Context`. */
  label: string;
  /** Strategy wired into the search store. */
  searchType: RestNotesSearchType;
  /** Alternative spellings accepted by the parser. */
  aliases: string[];
}

/** A command that can be typed after `/`. */
export interface SearchCommandDefinition {
  id: string;
  /** Primary token, e.g. `mode` in `/mode`. */
  name: string;
  /** Alternative tokens, e.g. `m` or `ctx`. */
  aliases: string[];
  /** Canonical display form, e.g. `/mode`. */
  label: string;
  /** Short description shown as the suggestion's secondary text. */
  description: string;
  /** When true the command expects an argument (`/mode <mode>`). */
  takesArg?: boolean;
  /** Strategy applied directly, for commands that take no argument. */
  searchType?: RestNotesSearchType;
  /** Non-strategy action applied directly, e.g. clearing the filter. */
  action?: "clear";
  /** Argument autocomplete options for argument-taking commands. */
  argOptions?: SearchModeOption[];
}

export interface SearchCommandSuggestion {
  id: string;
  /** Primary text, e.g. `/context`. */
  label: string;
  /** Secondary text describing the command / mode. */
  hint: string;
  /** Full input replacement used by Tab-completion. */
  completion: string;
  /** Strategy applied when the suggestion is executed. */
  searchType?: RestNotesSearchType;
  /** Non-strategy action applied when the suggestion is executed. */
  action?: "clear";
  /** Id of the command being completed. */
  commandId: string;
  /** Argument value, present for `/mode <value>` suggestions. */
  argValue?: string;
  /**
   * True when selecting the suggestion should only complete the
   * command (e.g. `/mode`) instead of executing it, because the
   * argument has not been chosen yet.
   */
  completesOnly?: boolean;
}

const MODE_OPTIONS: SearchModeOption[] = [
  {
    value: "keyword",
    label: "Keyword",
    searchType: RestNotesSearchType.KEYWORD,
    aliases: ["kw", "key"],
  },
  {
    value: "fuzzy",
    label: "Fuzzy",
    searchType: RestNotesSearchType.TYPO_TOLERANT,
    aliases: [
      "typo",
      "typo-tolerant",
      "typo_tolerant",
      "typotolerant",
      "similar",
      "similarity",
    ],
  },
  {
    value: "context",
    label: "Context",
    searchType: RestNotesSearchType.CONTEXT,
    aliases: ["ctx", "semantic", "meaning"],
  },
];

export const SEARCH_MODE_OPTIONS: SearchModeOption[] = MODE_OPTIONS;

export const SEARCH_COMMANDS: SearchCommandDefinition[] = [
  {
    id: "mode",
    name: "mode",
    aliases: ["m", "strategy"],
    label: "/mode",
    description: "Switch search mode",
    takesArg: true,
    argOptions: MODE_OPTIONS,
  },
  {
    id: "context",
    name: "context",
    aliases: ["ctx", "semantic"],
    label: "/context",
    description: "Search by meaning (Context)",
    searchType: RestNotesSearchType.CONTEXT,
  },
  {
    id: "keyword",
    name: "keyword",
    aliases: ["kw", "key"],
    label: "/keyword",
    description: "Match exact words (Keyword)",
    searchType: RestNotesSearchType.KEYWORD,
  },
  {
    id: "fuzzy",
    name: "fuzzy",
    aliases: [
      "typo",
      "typo-tolerant",
      "typo_tolerant",
      "typotolerant",
      "similar",
      "similarity",
    ],
    label: "/fuzzy",
    description: "Tolerate typos / find similar (Fuzzy)",
    searchType: RestNotesSearchType.TYPO_TOLERANT,
  },
  {
    id: "clear",
    name: "clear",
    aliases: ["reset", "x"],
    label: "/clear",
    description: "Clear the search filters",
    action: "clear",
  },
];

const normalize = (value: string): string => value.trim().toLowerCase();

/** Returns the command whose name or alias exactly matches `token`. */
export const findSearchCommand = (
  token: string,
): SearchCommandDefinition | undefined => {
  const normalized = normalize(token);
  return SEARCH_COMMANDS.find(
    (command) =>
      command.name === normalized || command.aliases.includes(normalized),
  );
};

/** Returns the mode option whose value or alias exactly matches `token`. */
export const findSearchModeOption = (
  token: string,
): SearchModeOption | undefined => {
  const normalized = normalize(token);
  return MODE_OPTIONS.find(
    (option) =>
      option.value === normalized || option.aliases.includes(normalized),
  );
};

/**
 * Scores how well a token matches a query. Higher is better; -1 means
 * no match. Exact > prefix > substring, and an empty query matches
 * everything with a neutral score so the full list is shown.
 */
const tokenScore = (token: string, query: string): number => {
  if (!query) return 0;
  const normalized = token.toLowerCase();
  if (normalized === query) return 3;
  if (normalized.startsWith(query)) return 2;
  if (normalized.includes(query)) return 1;
  return -1;
};

const bestTokenScore = (tokens: string[], query: string): number =>
  tokens.reduce((best, token) => Math.max(best, tokenScore(token, query)), -1);

interface Scored<T> {
  item: T;
  index: number;
  score: number;
}

const sortScored = <T>(items: Scored<T>[]): T[] =>
  items
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    })
    .map((entry) => entry.item);

/** Splits a command body into its first token and the remaining text. */
const splitBody = (
  body: string,
): { head: string; tail: string; hasTail: boolean } => {
  const spaceIndex = body.search(/\s/);
  if (spaceIndex === -1) {
    return { head: body, tail: "", hasTail: false };
  }
  return {
    head: body.slice(0, spaceIndex),
    tail: body.slice(spaceIndex + 1),
    hasTail: true,
  };
};

const commandSuggestions = (head: string): SearchCommandSuggestion[] => {
  const query = normalize(head);
  const scored: Scored<SearchCommandDefinition>[] = SEARCH_COMMANDS.map(
    (command, index) => ({
      item: command,
      index,
      score: bestTokenScore(
        [command.name, ...command.aliases],
        query,
      ),
    }),
  );

  return sortScored(scored).map((command) => ({
    id: command.id,
    label: command.label,
    hint: command.description,
    completion: `/${command.name}${command.takesArg ? " " : ""}`,
    searchType: command.searchType,
    action: command.action,
    commandId: command.id,
    // `/mode` can only be completed, not executed, until an argument
    // has been chosen; direct commands carry their own strategy.
    completesOnly: command.takesArg === true && command.searchType === undefined,
  }));
};

const modeSuggestions = (
  command: SearchCommandDefinition,
  tail: string,
): SearchCommandSuggestion[] => {
  if (!command.argOptions) return [];
  const query = normalize(tail.split(/\s+/)[0] ?? "");
  const scored: Scored<SearchModeOption>[] = command.argOptions.map(
    (option, index) => ({
      item: option,
      index,
      score: bestTokenScore([option.value, ...option.aliases], query),
    }),
  );

  return sortScored(scored).map((option) => ({
    id: `${command.id}:${option.value}`,
    label: `/${command.name} ${option.value}`,
    hint: `${option.label} search`,
    completion: `/${command.name} ${option.value}`,
    searchType: option.searchType,
    commandId: command.id,
    argValue: option.value,
  }));
};

/**
 * Returns the suggestions for the current search input. Only inputs
 * starting with `/` produce suggestions; a plain search query returns
 * an empty list so the normal search UX is untouched.
 */
export function getSearchCommandSuggestions(
  input: string,
): SearchCommandSuggestion[] {
  if (!input.startsWith("/")) return [];
  const body = input.slice(1);
  const { head, tail, hasTail } = splitBody(body);

  if (!hasTail) {
    return commandSuggestions(head);
  }

  const command = findSearchCommand(head);
  if (!command?.takesArg) return [];
  return modeSuggestions(command, tail);
}

export interface ResolvedSearchCommand {
  commandId: string;
  label: string;
  searchType?: RestNotesSearchType;
  argValue?: string;
  action?: "clear";
}

/**
 * Parses a fully-typed command into the strategy it should apply.
 * Returns null when the input is not a complete, executable command.
 *
 * Trailing text after a direct command (`/context some query`) is
 * ignored: the overlay clears the input after applying the command, so
 * the trailing text is discarded by design.
 */
export function resolveSearchCommand(
  input: string,
): ResolvedSearchCommand | null {
  if (!input.startsWith("/")) return null;
  const body = input.slice(1);
  const { head, tail, hasTail } = splitBody(body);
  const command = findSearchCommand(head);
  if (!command) return null;

  if (command.action !== undefined) {
    return {
      commandId: command.id,
      label: command.label,
      action: command.action,
    };
  }

  if (command.searchType !== undefined && command.takesArg !== true) {
    return {
      commandId: command.id,
      label: command.label,
      searchType: command.searchType,
    };
  }

  if (command.takesArg && command.argOptions) {
    const arg = normalize(tail);
    // Only a single argument is supported; extra words mean the user
    // is still typing (or typed something we shouldn't act on).
    if (!hasTail || !arg || /\s/.test(arg)) return null;
    const option = findSearchModeOption(arg);
    if (!option) return null;
    return {
      commandId: command.id,
      label: `/${command.name} ${option.value}`,
      searchType: option.searchType,
      argValue: option.value,
    };
  }

  return null;
}
