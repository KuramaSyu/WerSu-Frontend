// Tiny per-render counter for editor subcomponents. Logs once per
// component per render so we can see who re-renders.

const counters: Record<string, number> = {};

export function logRerender(
  name: string,
  extra?: Record<string, unknown>,
): void {
  counters[name] = (counters[name] ?? 0) + 1;
  // eslint-disable-next-line no-console
  console.log(
    `[editor-rerender] ${name} #${counters[name]}` +
      (extra ? " " + JSON.stringify(extra) : ""),
  );
}
