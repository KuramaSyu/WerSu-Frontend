import { useMemo } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { getTagApi } from "../TagApi";
import type {
  CreateTagBody,
  TagReply,
  UpdateTagBody,
} from "../models/tag";
import { SearchNotesApi } from "../SearchNotesApi";
import {
  RestNotesSearchType,
  type MinimalNote,
} from "../models/search";
import { useTagStore, mergeTagsFromNotesReply } from "../../zustand/useTagStore";
import { useIsAuthenticated, useUserKey } from "./useUser";

// Resolve through the api registry so the share-token provider installed on Bootstrap reaches this instance.
const tagApi = getTagApi();
// Plain instance, mirroring the other note-search hooks.
const searchNotesApi = new SearchNotesApi();

export const tagQueryKeys = {
  all: ["tags"] as const,
  list: (userKey: string | null) => ["tags", "list", userKey] as const,
  byId: (userKey: string | null, id: string) =>
    ["tags", "byId", id, userKey] as const,
  notes: (userKey: string | null, tagId: string) =>
    ["tags", "notes", tagId, userKey] as const,
};

/**
 * Fetches every tag via `GET /api/tags`.
 *
 * The reply is mirrored into `useTagStore` so note rows can resolve
 * tag ids to labels even on pages that never fetched the tag list.
 */
export function useTagsQuery(enabled = true) {
  const userKey = useUserKey();
  const isAuthed = useIsAuthenticated();

  return useQuery<TagReply[]>({
    queryKey: tagQueryKeys.list(userKey),
    queryFn: async () => {
      const tags = await tagApi.list();
      useTagStore.getState().upsertTags(tags);
      return tags;
    },
    enabled: enabled && isAuthed,
  });
}

/** Fetches a single tag via `GET /api/tags/:id`. */
export function useTagQuery(tagId?: string) {
  const userKey = useUserKey();
  const isAuthed = useIsAuthenticated();

  return useQuery<TagReply | undefined>({
    queryKey: tagQueryKeys.byId(userKey, tagId ?? ""),
    queryFn: async () => {
      if (!tagId) {
        throw new Error("tagId required");
      }
      const tag = await tagApi.get(tagId);
      if (tag) {
        useTagStore.getState().upsertTag(tag);
      }
      return tag;
    },
    enabled: Boolean(tagId) && isAuthed,
  });
}

/**
 * Convenience wrapper around `useTagsQuery` returning a memoised
 * `{ list, byId, isLoading }` result. Used by pickers that need both
 * the raw list (options) and fast id lookups (labels).
 */
export interface AllTagsQueryResult {
  list: TagReply[] | undefined;
  byId: Record<string, TagReply>;
  isLoading: boolean;
}

export function useAllTagsQuery(enabled = true): AllTagsQueryResult {
  const { data, isLoading } = useTagsQuery(enabled);
  const byId = useMemo<Record<string, TagReply>>(() => {
    const map: Record<string, TagReply> = {};
    for (const tag of data ?? []) {
      map[tag.id] = tag;
    }
    return map;
  }, [data]);
  return { list: data, byId, isLoading };
}

/**
 * Fetches the notes tagged with `tagId` via the notes search endpoint
 * (`include_tag_ids=[tagId]`).
 */
export function useTagNotesQuery(tagId?: string) {
  const userKey = useUserKey();
  const isAuthed = useIsAuthenticated();

  return useQuery<MinimalNote[]>({
    queryKey: tagQueryKeys.notes(userKey, tagId ?? ""),
    queryFn: async () => {
      if (!tagId) {
        throw new Error("tagId required");
      }
      const reply = await searchNotesApi.search(RestNotesSearchType.LATEST, "", {
        limit: 500,
        offset: 0,
        include_tag_ids: [tagId],
      });
      mergeTagsFromNotesReply(reply);
      return reply.notes;
    },
    enabled: Boolean(tagId) && isAuthed,
  });
}

/**
 * Mirrors a freshly-created or patched tag into every cached tag
 * list / detail entry and into the shared tag store.
 */
export const upsertTag = (
  queryClient: QueryClient,
  tag: TagReply,
): void => {
  queryClient.setQueriesData<TagReply[] | undefined>(
    { queryKey: ["tags", "list"] },
    (prev) => {
      if (!prev) {
        return prev;
      }
      return [...prev.filter((entry) => entry.id !== tag.id), tag];
    },
  );
  queryClient.setQueriesData<TagReply | undefined | null>(
    { queryKey: ["tags", "byId"] },
    (prev) => (prev && prev.id === tag.id ? tag : prev),
  );
  useTagStore.getState().upsertTag(tag);
};

/** Removes a tag from every cached tag list / detail entry and the store. */
export const removeTag = (
  queryClient: QueryClient,
  tagId: string,
): void => {
  queryClient.setQueriesData<TagReply[] | undefined>(
    { queryKey: ["tags", "list"] },
    (prev) => (prev ? prev.filter((tag) => tag.id !== tagId) : prev),
  );
  queryClient.setQueriesData<TagReply | undefined | null>(
    { queryKey: ["tags", "byId"] },
    (prev) => (prev && prev.id === tagId ? undefined : prev),
  );
  useTagStore.getState().removeTag(tagId);
};

/** Invalidates every query whose tag labels / membership can have changed. */
const invalidateTagQueries = (queryClient: QueryClient): void => {
  queryClient.invalidateQueries({ queryKey: ["tags"] });
};

/** Adding a tag only changes the taxonomy; existing note rows keep their ids. */
export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation<TagReply, Error, CreateTagBody>({
    mutationFn: (payload) => tagApi.create(payload),
    onSuccess: (tag) => {
      upsertTag(queryClient, tag);
      invalidateTagQueries(queryClient);
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation<TagReply, Error, { id: string; payload: UpdateTagBody }>({
    mutationFn: ({ id, payload }) => tagApi.patch(id, payload),
    onSuccess: (tag) => {
      upsertTag(queryClient, tag);
      invalidateTagQueries(queryClient);
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation<boolean, Error, string>({
    mutationFn: (tagId) => tagApi.delete(tagId),
    onSuccess: (deleted, tagId) => {
      if (!deleted) {
        return;
      }
      removeTag(queryClient, tagId);
      invalidateTagQueries(queryClient);
      // Deleting a tag strips it from every note server-side, so note
      // lists and directory-scoped note replies must refresh too.
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["directory", "notes"] });
    },
  });
}
