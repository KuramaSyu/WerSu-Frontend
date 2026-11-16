// Thin, lazily-loaded wrapper around the `mermaid` package.
//
// Mermaid is by far the heaviest runtime dependency of the editor, so it is
// imported dynamically on the first diagram render instead of being pulled
// into the initial note-page bundle. Everything else in the editor imports
// this module, never `mermaid` directly, which also keeps the preview
// component trivially mockable in tests (jsdom has no layout engine, so the
// real renderer cannot run there).

/** Mermaid's built-in theme names, narrowed to the ones we expose. */
export type MermaidTheme = "default" | "dark" | "forest" | "neutral";

/** Minimal structural type of the parts of the Mermaid API we call. */
interface MermaidApi {
  initialize: (config: Record<string, unknown>) => void;
  render: (
    id: string,
    text: string,
  ) => Promise<{ svg: string; bindFunctions?: (element: Element) => void }>;
}

let mermaidPromise: Promise<MermaidApi> | null = null;
let initializedTheme: MermaidTheme | null = null;
let renderCounter = 0;

/** Loads (and caches) the Mermaid module. */
const loadMermaid = (): Promise<MermaidApi> => {
  if (mermaidPromise === null) {
    mermaidPromise = import("mermaid").then(
      (module) => (module.default ?? module) as unknown as MermaidApi,
    );
  }
  return mermaidPromise;
};

const ensureInitialized = (api: MermaidApi, theme: MermaidTheme): void => {
  if (initializedTheme === theme) {
    return;
  }
  api.initialize({
    startOnLoad: false,
    // `strict` sanitises labels and forbids inline HTML/scripts coming
    // from note content.
    securityLevel: "strict",
    theme,
    fontFamily: "'Fira Sans', system-ui, sans-serif",
  });
  initializedTheme = theme;
};

/**
 * Renders `code` to standalone SVG markup.
 *
 * @throws when Mermaid rejects the diagram (syntax error); callers show the
 * message instead of a diagram.
 */
export const renderMermaid = async (
  code: string,
  theme: MermaidTheme = "default",
): Promise<string> => {
  const api = await loadMermaid();
  ensureInitialized(api, theme);
  // Render IDs must be unique per call; Mermaid uses them to scope the
  // temporary DOM node it measures the diagram in.
  renderCounter += 1;
  const { svg } = await api.render(`mermaid-diagram-${renderCounter}`, code);
  return svg;
};

/** Test/theme-switch hook: forget the loaded instance and its config. */
export const resetMermaidRenderer = (): void => {
  mermaidPromise = null;
  initializedTheme = null;
  renderCounter = 0;
};