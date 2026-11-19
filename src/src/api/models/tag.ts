import type { MinimalTag } from "./search";

/** REST representation of a tag. Mirrors `controllers.TagReply`. */
export interface TagReply extends MinimalTag {
  id: string;
  slug: string;
  display_name: string;
}

/** Body for `POST /api/tags`. */
export interface CreateTagBody {
  /** Unique, machine-readable slug. */
  slug: string;
  /** Human-readable label. */
  display_name: string;
}

/** Body for `PATCH /api/tags/:id`. Omitted fields are left unchanged. */
export interface UpdateTagBody {
  slug?: string;
  display_name?: string;
}

/** Reply for `DELETE /api/tags/:id`. */
export interface DeleteTagReply {
  /** True when a tag row was actually removed. */
  deleted: boolean;
}

/** Resolves the user-facing label for a tag, falling back to slug / id. */
export function tagLabel(
  tag: { id?: string; slug?: string; display_name?: string } | undefined,
  fallback = "",
): string {
  return tag?.display_name?.trim() || tag?.slug || tag?.id || fallback;
}
