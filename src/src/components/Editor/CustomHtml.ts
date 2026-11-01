// Raw HTML passthrough nodes for the markdown editor.
//
// Lets users drop arbitrary block HTML (`<details>`, `<aside>`, custom
// widgets, styled `<table>`s, ...) into markdown source and have it
// round-trip without being rewritten to a different representation.
//
// There are two layers:
//
// 1. `BlockHtml` is an atom node that stores the raw HTML string and
//    injects it into the DOM via a node view. It claims block HTML tags
//    that the schema has no sensible representation for (`<aside>`,
//    `<section>`, `<article>`, ...).
//
// 2. `HtmlPreservation` lets block HTML that *does* parse into native
//    ProseMirror nodes (e.g. `<table style="...">` becoming a real,
//    editable table) keep the original HTML. The parse step annotates the
//    resulting node with a `htmlSource` attribute holding the raw HTML
//    fragment plus a `htmlSourceSignature` of the parsed content.
//
//    On serialization:
//      - unedited nodes (signature still matches) emit `htmlSource`
//        byte-for-byte, so a custom-styled table survives exactly;
//      - edited nodes regenerate their HTML from the current rich content
//        and re-apply the original element attributes by tag+position, so
//        adding a row keeps the table's custom style instead of being
//        silently dropped.
//
// The attributes are registered as global node attributes so ProseMirror
// (and Yjs) keep them on the node. The parse handler needs the editor's
// schema to run `generateJSON` on the fragment; because Tiptap's markdown
// parse handlers do not receive the editor, `HtmlPreservation` installs a
// small module-level hook around `markdown.parse` and wraps
// `renderNodeToMarkdown` for the write-back.
//
// Inline arbitrary HTML (e.g. `<span>` mid-paragraph) is not currently
// supported beyond `<br/>` and styled `<img>` — the inline `html` token
// path in @tiptap/markdown bypasses registered handlers.

import {
  Extension,
  Node,
  generateJSON,
  type Editor,
  type JSONContent,
  type MarkdownParseResult,
  type MarkdownToken,
} from "@tiptap/core";
import {
  DOMSerializer,
  Node as ProseMirrorNode,
  type Schema,
} from "@tiptap/pm/model";

/** Attribute used to remember the raw HTML a node was parsed from. */
export const HTML_SOURCE_ATTR = "htmlSource";
/**
 * Attribute holding a hash of the node content the raw HTML was parsed
 * from. When it stops matching, the node has been edited and the raw
 * HTML is regenerated instead of being emitted stale.
 */
export const HTML_SOURCE_SIGNATURE_ATTR = "htmlSourceSignature";

// The editor currently parsing markdown. Set around `markdown.parse`
// (and during `onBeforeCreate` for the initial content parse) so the
// HTML parse handler below can reach the schema to run `generateJSON`.
let activeEditor: Editor | null = null;

const shared = {
  atom: true,
  content: "",
  addAttributes() {
    return {
      html: { default: "" },
    };
  },
  renderMarkdown: (node: JSONContent) =>
    formatCustomHtml((node.attrs?.html as string | undefined) ?? ""),
  // Build a DOM node that injects the saved HTML. Atom + content:"" means
  // the children slot is unused; we own the inner markup entirely.
  addNodeView() {
    return ({ node }: { node: { attrs: { html?: string } } }) => {
      const dom = document.createElement("div");
      dom.className = "custom-html-node";
      dom.innerHTML = node.attrs.html ?? "";
      return { dom };
    };
  },
};

export const BlockHtml = Node.create({
  ...shared,
  name: "blockHtml",
  markdownTokenName: "html",
  group: "block",
  inline: false,
  parseHTML() {
    return [{ tag: "div.custom-html-node" }];
  },
  renderHTML() {
    return [
      "div",
      { "data-type": "custom-html-block", class: "custom-html-node" },
    ];
  },
  // Block html tokens: claim unknown block tags (<details>, <aside>, ...)
  // and let known schema blocks (<table>, <p>, <div>, ...) through.
  parseMarkdown: (token: MarkdownToken): MarkdownParseResult => {
    if (!token.block) {
      // Returning null signals "skip this token"; see CustomDetails for
      // the rationale behind the cast.
      return null as unknown as MarkdownParseResult;
    }
    const html = (token.raw ?? "").trim();
    const tag = /^<([a-zA-Z][\w-]*)/.exec(html)?.[1].toLowerCase();
    if (!tag) {
      return null as unknown as MarkdownParseResult;
    }
    const known = new Set([
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
      "p",
      "div",
      "blockquote",
      "pre",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      // <details> has its own schema extension; let it win.
      "details",
      "summary",
    ]);
    if (!known.has(tag)) {
      return { type: "blockHtml", attrs: { html: token.raw ?? "" } };
    }

    // <details>/<summary> are owned by CustomDetails and the schema-aware
    // fallback. Claiming them here would drop the implicit empty summary
    // the schema fills in for `<details></details>`.
    if (tag === "details" || tag === "summary") {
      return null as unknown as MarkdownParseResult;
    }

    // A known tag: parse it with the schema so the user gets an editable
    // rich node (a real table, a paragraph, ...) and remember the raw
    // HTML so serialization can write it back verbatim. Store the
    // trimmed fragment so trailing whitespace does not accumulate on
    // every round-trip.
    const parsed = parseKnownHtmlBlock(html);
    if (!parsed) {
      return { type: "blockHtml", attrs: { html } };
    }
    // Only annotate when the fragment maps to a single top-level node.
    // Multiple nodes would duplicate the HTML on the way back out.
    if (parsed.length !== 1) {
      return { type: "blockHtml", attrs: { html } };
    }
    const node = parsed[0];
    const withSource: JSONContent = {
      ...node,
      attrs: {
        ...(node.attrs ?? {}),
        [HTML_SOURCE_ATTR]: html,
        [HTML_SOURCE_SIGNATURE_ATTR]: signatureOfJson(node),
      },
    };
    return withSource;
  },
});

// Parse an HTML fragment into schema nodes using the editor that is
// currently running a markdown parse. Returns null when no editor is
// available (e.g. the manager is used stand-alone in a test) or the
// fragment cannot be parsed. Nodes are normalized through the schema so
// the signature we store matches the attrs ProseMirror fills in later.
function parseKnownHtmlBlock(html: string): JSONContent[] | null {
  const editor = activeEditor;
  if (!editor || typeof window === "undefined") {
    return null;
  }
  try {
    const parsed = generateJSON(html, editor.extensionManager.baseExtensions);
    const nodes: JSONContent[] =
      parsed.type === "doc"
        ? ((parsed.content ?? []) as JSONContent[])
        : [parsed as JSONContent];
    return nodes.map((node) =>
      ProseMirrorNode.fromJSON(editor.schema, node).toJSON(),
    );
  } catch {
    return null;
  }
}

// --- HTML regeneration helpers -------------------------------------------

/** Small, stable, non-cryptographic hash for the content signature. */
function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Recursively drop the preservation attributes so the signature only
 * depends on type/content/attrs the user can actually edit.
 */
function stripSourceAttrs(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripSourceAttrs);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === HTML_SOURCE_ATTR || key === HTML_SOURCE_SIGNATURE_ATTR) {
        continue;
      }
      out[key] = stripSourceAttrs(child);
    }
    return out;
  }
  return value;
}

function signatureOfJson(json: JSONContent): string {
  return hashString(JSON.stringify(stripSourceAttrs(json)));
}

function parseHtmlElement(html: string): Element | null {
  if (typeof document === "undefined") {
    return null;
  }
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

// --- HTML pretty-printing ------------------------------------------------

const NODE_TYPE_ELEMENT = 1;
const NODE_TYPE_TEXT = 3;
const NODE_TYPE_COMMENT = 8;

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

// Tags whose contents must be emitted verbatim (whitespace is meaningful).
const RAW_TEXT_TAGS = new Set(["pre", "code", "textarea", "script", "style"]);

// Block-level tags get their own line; everything else stays inline with
// its surrounding text so `<p><strong>x</strong></p>` stays one line.
const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "colgroup",
  "dd",
  "details",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function formatAttributes(element: Element): string {
  return Array.from(element.attributes)
    .map((attribute) => ` ${attribute.name}="${escapeHtmlAttribute(attribute.value)}"`)
    .join("");
}

/** Child nodes that are not insignificant whitespace. */
function meaningfulChildren(
  parent: Element | DocumentFragment,
): ChildNode[] {
  return Array.from(parent.childNodes).filter((child) => {
    if (child.nodeType === NODE_TYPE_TEXT) {
      return (child.textContent ?? "").trim().length > 0;
    }
    return (
      child.nodeType === NODE_TYPE_ELEMENT ||
      child.nodeType === NODE_TYPE_COMMENT
    );
  });
}

function formatNode(node: ChildNode, depth: number): string {
  const pad = "  ".repeat(depth);
  if (node.nodeType === NODE_TYPE_TEXT) {
    return pad + escapeHtmlText(node.textContent ?? "");
  }
  if (node.nodeType === NODE_TYPE_COMMENT) {
    return `${pad}<!--${node.textContent ?? ""}-->`;
  }
  if (node.nodeType !== NODE_TYPE_ELEMENT) {
    return pad + escapeHtmlText(node.textContent ?? "");
  }

  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  const open = `<${tag}${formatAttributes(element)}>`;
  if (VOID_TAGS.has(tag)) {
    return pad + open;
  }
  if (RAW_TEXT_TAGS.has(tag)) {
    return pad + element.outerHTML;
  }

  const children = meaningfulChildren(element);
  if (children.length === 0) {
    return `${pad}${open}</${tag}>`;
  }

  const hasBlockChild = children.some(
    (child) =>
      child.nodeType === NODE_TYPE_ELEMENT &&
      BLOCK_TAGS.has((child as Element).tagName.toLowerCase()),
  );
  if (!hasBlockChild) {
    // Keep inline markup on a single line with its text.
    return `${pad}${open}${element.innerHTML}</${tag}>`;
  }

  const inner = children
    .map((child) => formatNode(child, depth + 1))
    .join("\n");
  return `${pad}${open}\n${inner}\n${pad}</${tag}>`;
}

/**
 * Pretty-print a block HTML fragment with two-space indentation so the
 * markdown source stays readable. Inline-only elements stay on one line;
 * whitespace-sensitive tags (`<pre>`, ...) are emitted verbatim. Returns
 * the input unchanged when there is no DOM or the fragment cannot be
 * parsed, and is idempotent for already-formatted input.
 */
export function formatCustomHtml(html: string): string {
  if (typeof document === "undefined") {
    return html;
  }
  const trimmed = html.trim();
  if (!trimmed) {
    return html;
  }
  try {
    const template = document.createElement("template");
    template.innerHTML = trimmed;
    const nodes = meaningfulChildren(template.content);
    if (nodes.length === 0) {
      return html;
    }
    return nodes.map((node) => formatNode(node, 0)).join("\n");
  } catch {
    return html;
  }
}

/** All elements in `root` (inclusive), in document order. */
function collectAllElements(root: Element): Element[] {
  const elements: Element[] = [root];
  root.querySelectorAll("*").forEach((element) => elements.push(element));
  return elements;
}

/**
 * Identity for matching regenerated elements to their originals. Tag plus
 * trimmed text keeps per-cell styles aligned even when a row is inserted
 * or deleted in the middle (there the plain document order would shift).
 */
function elementMatchKey(element: Element): string {
  return `${element.tagName.toLowerCase()}|${(
    element.textContent ?? ""
  ).trim()}`;
}

function applyAttributes(original: Element, next: Element): void {
  for (const attribute of Array.from(original.attributes)) {
    const name = attribute.name.toLowerCase();
    // Structural attributes come from the edited rich node, not the
    // original fragment (rows/cells may have been added or removed).
    if (name === "colspan" || name === "rowspan") {
      continue;
    }
    if (name === "style") {
      // The user's custom styling wins over ProseMirror's defaults.
      next.setAttribute("style", attribute.value);
    } else if (name === "class") {
      const existing = next.getAttribute("class");
      next.setAttribute(
        "class",
        existing ? `${existing} ${attribute.value}` : attribute.value,
      );
    } else if (!next.hasAttribute(name)) {
      next.setAttribute(name, attribute.value);
    }
  }
}

function directCells(row: Element): Element[] {
  return Array.from(row.children).filter(
    (child) => child.tagName === "TD" || child.tagName === "TH",
  );
}

/**
 * Table-aware merge: keep the table/section attributes, match unchanged
 * rows by their text (so a middle insert/delete doesn't shift styles),
 * fall back to row order for new/edited rows, then match cells by column
 * index. New rows/cells simply get no inherited style.
 */
function copyTableAttributes(original: Element, next: Element): void {
  applyAttributes(original, next);

  const originalSections = Array.from(
    original.querySelectorAll("thead,tbody,tfoot"),
  );
  const nextSections = Array.from(next.querySelectorAll("thead,tbody,tfoot"));
  for (let i = 0; i < Math.min(originalSections.length, nextSections.length); i += 1) {
    applyAttributes(originalSections[i], nextSections[i]);
  }

  const nextRows = Array.from(next.querySelectorAll("tr"));
  const unmatched = Array.from(original.querySelectorAll("tr"));
  const matches = new Map<Element, Element>();

  for (const nextRow of nextRows) {
    const key = (nextRow.textContent ?? "").trim();
    const index = unmatched.findIndex(
      (row) => (row.textContent ?? "").trim() === key,
    );
    if (index >= 0) {
      matches.set(nextRow, unmatched[index]);
      unmatched.splice(index, 1);
    }
  }
  for (const nextRow of nextRows) {
    if (matches.has(nextRow)) {
      continue;
    }
    const originalRow = unmatched.shift();
    if (originalRow) {
      matches.set(nextRow, originalRow);
    }
  }

  for (const [nextRow, originalRow] of matches) {
    applyAttributes(originalRow, nextRow);
    const originalCells = directCells(originalRow);
    const nextCells = directCells(nextRow);
    for (let i = 0; i < Math.min(originalCells.length, nextCells.length); i += 1) {
      applyAttributes(originalCells[i], nextCells[i]);
    }
  }
}

/**
 * Copy attributes from the original HTML element tree onto the freshly
 * serialized one. Elements are matched by tag + text first (so unchanged
 * cells keep their style when rows are inserted/removed), then by tag in
 * document order as a fallback (e.g. an edited cell whose text changed).
 */
function copyOriginalAttributes(original: Element, next: Element): void {
  if (original.tagName === "TABLE" && next.tagName === "TABLE") {
    copyTableAttributes(original, next);
    return;
  }

  const originalByKey = new Map<string, Element[]>();
  for (const element of collectAllElements(original)) {
    const key = elementMatchKey(element);
    const list = originalByKey.get(key);
    if (list) {
      list.push(element);
    } else {
      originalByKey.set(key, [element]);
    }
  }

  const positional = collectAllElements(original);
  for (const nextElement of collectAllElements(next)) {
    const candidates = originalByKey.get(elementMatchKey(nextElement));
    let match = candidates?.shift();
    if (!match) {
      match = positional.find(
        (element) => element.tagName === nextElement.tagName,
      );
      if (match) {
        // Consume it from the key index too, so a later element with the
        // same key cannot claim it twice.
        const list = originalByKey.get(elementMatchKey(match));
        const listIndex = list ? list.indexOf(match) : -1;
        if (list && listIndex >= 0) {
          list.splice(listIndex, 1);
        }
      }
    }
    if (!match) {
      continue;
    }
    const index = positional.indexOf(match);
    if (index >= 0) {
      positional.splice(index, 1);
    }
    applyAttributes(match, nextElement);
  }
}

/**
 * Strip schema artifacts that make the regenerated HTML noisier than the
 * fragment the user wrote: drop the table `<colgroup>` when the original
 * had none, and remove default `colspan`/`rowspan="1"`.
 */
function cleanRegeneratedMarkup(element: Element, original: Element | null): void {
  element.querySelectorAll('[colspan="1"]').forEach((el) => {
    el.removeAttribute("colspan");
  });
  element.querySelectorAll('[rowspan="1"]').forEach((el) => {
    el.removeAttribute("rowspan");
  });
  if (element.tagName.toLowerCase() === "table") {
    const originalHadColgroup = original?.querySelector("colgroup") ?? null;
    if (!originalHadColgroup) {
      element.querySelector("colgroup")?.remove();
    }
  }
}

function elementFromSerialized(dom: unknown): Element | null {
  if (typeof Element !== "undefined" && dom instanceof Element) {
    return dom;
  }
  if (
    typeof DocumentFragment !== "undefined" &&
    dom instanceof DocumentFragment
  ) {
    return dom.firstElementChild;
  }
  return null;
}

/**
 * Serialize the edited rich node to HTML and re-apply the original
 * element attributes. Falls back to the raw fragment when there is no
 * DOM (SSR) or serialization fails.
 */
function regeneratePreservedHtml(
  rawHtml: string,
  node: ProseMirrorNode,
  schema: Schema,
): string {
  if (typeof document === "undefined") {
    return rawHtml;
  }
  try {
    const serializer = DOMSerializer.fromSchema(schema);
    const element = elementFromSerialized(serializer.serializeNode(node));
    if (!element) {
      return rawHtml;
    }
    const original = parseHtmlElement(rawHtml);
    if (original) {
      copyOriginalAttributes(original, element);
    }
    cleanRegeneratedMarkup(element, original);
    return element.outerHTML;
  } catch {
    return rawHtml;
  }
}

// Runs before the Markdown extension (priority 1000) so `activeEditor`
// is already set when Markdown's own `onBeforeCreate` parses the initial
// `contentType: "markdown"` content. Also owns the preservation global
// attributes so ProseMirror/Yjs keep them on the node.
export const HtmlSourceContext = Extension.create({
  name: "htmlSourceContext",
  priority: 1000,
  addGlobalAttributes() {
    return [
      {
        types: "nodes",
        attributes: {
          [HTML_SOURCE_ATTR]: {
            default: null,
            // Keep the DOM and rendered HTML free of this internal attr.
            renderHTML: () => ({}),
            parseHTML: () => null,
          },
          [HTML_SOURCE_SIGNATURE_ATTR]: {
            default: null,
            renderHTML: () => ({}),
            parseHTML: () => null,
          },
        },
      },
    ];
  },
  onBeforeCreate() {
    activeEditor = this.editor as Editor;
  },
  onDestroy() {
    if (activeEditor === (this.editor as Editor)) {
      activeEditor = null;
    }
  },
});

// Runs after the Markdown extension (priority 50) so `editor.markdown`
// already exists. Wraps the manager so every parse is scoped to the
// right editor and every serialization writes raw HTML back for
// `htmlSource` nodes.
//
// Serialization is intercepted on `renderNodeToMarkdown` (the single
// choke point every `manager.serialize` / `editor.getMarkdown` call goes
// through) rather than by replacing `editor.getMarkdown`. That keeps it
// working regardless of extension ordering, editor re-creation (the
// note editor rebuilds when entering edit mode), or callers that reach
// the manager directly.
//
// `onBeforeCreate` (not `onCreate`) is used because headless editors
// never emit `create` (that only happens after the editor is mounted to
// a DOM element).
export const HtmlSerialization = Extension.create({
  name: "htmlSerialization",
  priority: 50,
  onBeforeCreate() {
    const editor = this.editor as Editor;
    const manager = editor.markdown;
    if (!manager) {
      return;
    }

    // Scope `activeEditor` to the editor whose markdown is being parsed,
    // so multiple mounted editors don't leak schema into each other.
    const originalParse = manager.parse.bind(manager);
    manager.parse = (markdown: string) => {
      const previous = activeEditor;
      activeEditor = editor;
      try {
        return originalParse(markdown);
      } finally {
        activeEditor = previous;
      }
    };

    // On the way out: an unedited node emits its stored HTML verbatim; an
    // edited one is regenerated from the current rich content so edits
    // show up in source/save while the custom element attributes survive.
    const originalRenderNode = manager.renderNodeToMarkdown.bind(manager);
    manager.renderNodeToMarkdown = (
      node: JSONContent,
      parentNode?: JSONContent,
      index = 0,
      level = 0,
      meta: Record<string, unknown> = {},
    ) => {
      const rawHtml = node?.attrs?.[HTML_SOURCE_ATTR];
      if (typeof rawHtml === "string" && rawHtml.length > 0) {
        const signature = node.attrs?.[HTML_SOURCE_SIGNATURE_ATTR];
        if (signature === signatureOfJson(node)) {
          return formatCustomHtml(rawHtml);
        }
        try {
          const pmNode = ProseMirrorNode.fromJSON(editor.schema, node);
          return formatCustomHtml(
            regeneratePreservedHtml(rawHtml, pmNode, editor.schema),
          );
        } catch {
          return formatCustomHtml(rawHtml);
        }
      }
      return originalRenderNode(node, parentNode, index, level, meta);
    };
  },
});

// Placeholder kept so existing imports compile. Inline arbitrary HTML is
// not currently supported beyond <br/> and styled <img>; see README.
export const InlineHtml = BlockHtml.extend({ name: "inlineHtml" });

export const CustomHtml = [
  BlockHtml,
  HtmlSourceContext,
  HtmlSerialization,
];
