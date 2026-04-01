import { useQuery } from "@tanstack/react-query";
import { DirectoryApi, type ListDirectoriesQuery } from "../DirectoryApi";

const directoryApi = new DirectoryApi();

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
    queryFn: () => directoryApi.list(query),
    enabled,
  });
