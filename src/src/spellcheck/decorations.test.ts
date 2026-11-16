import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { buildSpellcheckDecorations, SPELLCHECK_ERROR_CLASS } from "./decorations";
import type { SpellChecker } from "./dictionary";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*", toDOM: () => ["p", 0] },
    codeBlock: {
      group: "block",
      content: "text*",
      code: true,
      toDOM: () => ["pre", ["code", 0]],
    },
    text: { group: "inline" },
  },
  marks: {
    code: { code: true, toDOM: () => ["code", 0] },
  },
});

/** Only "Hallo", "Welt" and "Grüße" are known; everything else is a typo. */
const checker: SpellChecker = {
  check: (word) => ["Hallo", "Welt", "Grüße"].includes(word),
  suggest: () => [],
};

const doc = schema.node("doc", null, [
  schema.node("paragraph", null, [
    schema.text("Hallo Wlet "),
    schema.text("Code", [schema.mark("code")]),
  ]),
  schema.node("codeBlock", null, [schema.text("Falsch")]),
]);

function decoratedWords(
  decorations: ReturnType<typeof buildSpellcheckDecorations>,
  document: ProseMirrorNode,
): string[] {
  return decorations
    .find(0, document.content.size)
    .map((decoration) => document.textBetween(decoration.from, decoration.to));
}

describe("buildSpellcheckDecorations", () => {
  it("flags only unknown prose words", () => {
    const decorations = buildSpellcheckDecorations(doc, checker);
    expect(decoratedWords(decorations, doc)).toEqual(["Wlet"]);
  });

  it("ignores inline code marks and code blocks", () => {
    const decorations = buildSpellcheckDecorations(doc, checker);
    const ranges = decorations.find(0, doc.content.size);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].spec.word).toBe("Wlet");
  });

  it("uses the shared error class", () => {
    const decorations = buildSpellcheckDecorations(doc, checker);
    const [first] = decorations.find(0, doc.content.size);
    const attrs = (first as unknown as { type: { attrs: Record<string, unknown> } })
      .type.attrs;
    expect(attrs.class).toBe(SPELLCHECK_ERROR_CLASS);
  });
});