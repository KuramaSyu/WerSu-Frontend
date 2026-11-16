// Tiptap extension that paints misspelled words.
//
// Decorations are rebuilt on a short debounce after typing, and
// immediately when the spell-check setting changes. A meta-only
// transaction carries the new set back into the plugin state, so the
// document (and its history) is never touched.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";
import { buildSpellcheckDecorations } from "./decorations";
import { useSpellcheckStore } from "./spellcheckStore";

/** Debounce so a whole paragraph is not re-checked per keystroke. */
const RESCAN_DELAY_MS = 250;

export interface SpellcheckPluginState {
  decorations: DecorationSet;
}

export const SPELLCHECK_PLUGIN_KEY = new PluginKey<SpellcheckPluginState>(
  "spellcheckDecorations",
);

function decorationsFor(view: EditorView): DecorationSet {
  const { enabled, checker } = useSpellcheckStore.getState();
  if (!enabled || !checker) return DecorationSet.empty;
  try {
    return buildSpellcheckDecorations(view.state.doc, checker);
  } catch (error) {
    // A broken dictionary must not take the editor down with it.
    console.error("Spell check failed", error);
    return DecorationSet.empty;
  }
}

export const SpellcheckExtension = Extension.create({
  name: "spellcheck",

  addProseMirrorPlugins() {
    return [
      new Plugin<SpellcheckPluginState>({
        key: SPELLCHECK_PLUGIN_KEY,

        state: {
          init: () => ({ decorations: DecorationSet.empty }),
          apply: (transaction, value) => {
            const meta = transaction.getMeta(SPELLCHECK_PLUGIN_KEY) as
              | SpellcheckPluginState
              | undefined;
            if (meta) return meta;
            if (transaction.docChanged) {
              // Keep the old underlines roughly in place while the
              // debounced rescan runs.
              return {
                decorations: value.decorations.map(transaction.mapping, transaction.doc),
              };
            }
            return value;
          },
        },

        props: {
          decorations(state) {
            return SPELLCHECK_PLUGIN_KEY.getState(state)?.decorations;
          },
        },

        view(view) {
          let timer: ReturnType<typeof setTimeout> | null = null;

          const dispatch = () => {
            if (view.isDestroyed) return;
            view.dispatch(
              view.state.tr.setMeta(SPELLCHECK_PLUGIN_KEY, {
                decorations: decorationsFor(view),
              }),
            );
          };

          const schedule = (delay: number) => {
            if (timer !== null) clearTimeout(timer);
            timer = setTimeout(() => {
              timer = null;
              dispatch();
            }, delay);
          };

          const unsubscribe = useSpellcheckStore.subscribe((state, previous) => {
            if (state.version !== previous.version) schedule(0);
          });

          // Defer the first scan: dispatching during view creation is
          // not safe.
          schedule(0);

          return {
            update(nextView, previous) {
              if (previous.doc !== nextView.state.doc) {
                schedule(RESCAN_DELAY_MS);
              }
            },
            destroy() {
              unsubscribe();
              if (timer !== null) clearTimeout(timer);
            },
          };
        },
      }),
    ];
  },
});