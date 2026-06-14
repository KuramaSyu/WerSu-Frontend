import Image from "@tiptap/extension-image";
import { NodeSelection } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageNodeView } from "../controllers/ImageNodeView";

export const CustomImage = Image.extend({
  inline: false,
  group: "block",
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
