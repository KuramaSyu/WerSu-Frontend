import { useQuery } from "@tanstack/react-query";
import { getDirectoryApi, type ListDirectoriesQuery } from "../DirectoryApi";

// Use the registered singleton so the share-token provider installed on
// `Bootstrap` reaches this instance. See `useNoteQueries` for rationale.
const directoryApi = getDirectoryApi();

export const directoryQueryKeys = {
  all: ["directories"] as const,
  list: (query: ListDirectoriesQuery = {}) =>
    ["directories", "list", query] as const,
};

export const useDirectoriesQuery = (
  query: ListDirectoriesQuery,
  enabled: boolean,
) =>
  useQuery({
    queryKey: directoryQueryKeys.list(query),
    queryFn: async () => await directoryApi.list(query),
    enabled,
  });
