/**
 * Thrown by `StatusApi.getStatus()` when the REST backend URL isn't
 * configured (or points at the SPA itself), so the user sees an
 * actionable message instead of
 * `JSON.parse: unexpected character at line 1 column 1 of the JSON data`
 * from `response.json()` choking on the served `index.html`.
 *
 * The message names the file the user needs to create and the keys
 * it must contain. The `file` / `example` fields carry the same data
 * in a structured form so the Settings UI can render a `.env` builder
 * directly off the error, without re-parsing the prose message.
 */

export interface EnvVarSpec {
  /** Environment variable name as it must appear in the file (e.g. `VITE_BACKEND_URL`). */
  readonly key: string;
  /** Short, user-facing label for the input field. */
  readonly label: string;
  /** Helpful placeholder shown in the empty input. */
  readonly placeholder: string;
  /** `true` if missing this value would still let the app boot (e.g. Hocuspocus URL). */
  readonly optional?: boolean;
}

/**
 * Catalog of `.env` keys the frontend needs at build time. Each spec
 * feeds one row of the builder; the `.env` line emitted by the builder
 * is `VITE_<KEY>=<value>` with a leading comment from the spec.
 *
 * Adding a new build-time config? Add the spec here and the Settings
 * panel will surface a new builder field on its own.
 */
export const REQUIRED_ENV_VARS: readonly EnvVarSpec[] = [
  {
    key: "VITE_BACKEND_URL",
    label: "Backend base URL",
    placeholder: "http://localhost:8080",
  },
  {
    key: "VITE_HOCUSPOCUS_WS_URL",
    label: "Hocuspocus WebSocket URL",
    placeholder: "ws://localhost:8666",
    optional: true,
  },
];

/**
 * Build the `KEY=value` line for a single env var. Includes a leading
 * `# ` comment line when the spec provides one, so the resulting
 * snippet is ready to paste.
 */
export function buildEnvLine(spec: EnvVarSpec, value: string): string {
  const trimmed = value.trim();
  return `${spec.key}=${trimmed}`;
}

/**
 * Build the full `src/.env` body from a map of `key -> value`. Missing
 * required keys are skipped silently (the UI disables the emit button
 * when any required value is empty); optional keys with empty values
 * are also skipped so the emitted file stays minimal.
 */
export function buildEnvBody(values: Record<string, string>): string {
  const lines: string[] = [];
  for (const spec of REQUIRED_ENV_VARS) {
    const raw = values[spec.key] ?? "";
    const value = raw.trim();
    if (!value) {
      continue;
    }
    lines.push(buildEnvLine(spec, value));
  }
  return lines.join("\n") + "\n";
}

/**
 * Snippet of a working `src/.env` for users who haven't configured
 * the backend yet. Kept in one place so the message and the builder
 * stay in sync.
 */
export const EXAMPLE_ENV_FILE = "src/.env";
export const EXAMPLE_ENV_BODY = `# Copy from src/.example-env and uncomment / fill in.
# How the backend is reachable from the browser's perspective.
VITE_BACKEND_URL=http://localhost:8080
# Optional: WebSocket URL of the Hocuspocus collab server.
VITE_HOCUSPOCUS_WS_URL=ws://localhost:8666
`;

/**
 * Reasons a `StatusApiConfigError` can be raised. Carries the
 * short message rather than a multi-line blob; the long `.env`
 * example lives on `StatusApiConfigError.example` and is rendered
 * by the Settings builder, not inlined into the alert.
 */
export const CONFIG_ERROR_REASONS = {
  missingUrl: `Set VITE_BACKEND_URL in "${EXAMPLE_ENV_FILE}", then restart the dev server.`,
  wrongHost: (host: string) =>
    `${host} returned HTML instead of JSON. Check VITE_BACKEND_URL in "${EXAMPLE_ENV_FILE}".`,
  parseFailed: (detail: string) =>
    `Could not parse the backend response (${detail}). Check VITE_BACKEND_URL in "${EXAMPLE_ENV_FILE}".`,
} as const;

export class StatusApiConfigError extends Error {
  readonly file: string;
  readonly example: string;

  constructor(file: string, example: string, message: string) {
    super(message);
    this.name = "StatusApiConfigError";
    this.file = file;
    this.example = example;
  }
}