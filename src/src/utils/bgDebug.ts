// Debug logger for the background-image upload + blob-cache pipeline.
// Every line is prefixed with [bg-debug] so it is easy to filter in
// DevTools. All calls are silent unless the BackgroundImageDebug
// feature flag is on, so production builds never log anything.
//
// All call sites must pass a single formatted string (template
// literal) rather than a printf-style format + args tuple. console
// only treats the first argument as a format string, so
// `console.debug("[bg-debug]", "openDb: %s", name)` would print
// the literal `%s`. Wrap non-string args with String() if needed.

import { FeatureFlagName, useFeatureStore } from "../zustand/FeatureStore";

const isEnabled = (): boolean =>
  useFeatureStore.getState().flags[FeatureFlagName.BackgroundImageDebug];

const format = (message: unknown): string => {
  if (typeof message === "string") return message;
  if (message instanceof Error) return message.stack ?? message.message;
  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
};

// Three severity levels mirror the underlying console methods so
// per-call intent is preserved (a stuck IDB put still shows in red).
export const bgLog = (message: unknown): void => {
  if (!isEnabled()) return;
  // eslint-disable-next-line no-console
  console.debug(`[bg-debug] ${format(message)}`);
};

export const bgLogWarn = (message: unknown): void => {
  if (!isEnabled()) return;
  // eslint-disable-next-line no-console
  console.warn(`[bg-debug] ${format(message)}`);
};

export const bgLogError = (message: unknown): void => {
  if (!isEnabled()) return;
  // eslint-disable-next-line no-console
  console.error(`[bg-debug] ${format(message)}`);
};
