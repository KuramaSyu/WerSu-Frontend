import { useQuery } from "@tanstack/react-query";
import { useUserStore } from "./zustand/userStore";
import { SearchNotesApi } from "./api/SearchNotesApi";
import { RestNotesSearchType } from "./api/models/search";
import { UserApi } from "./api/UserApi";

/**
 * Ensures, that on page load the user and notes get loaded
 */
export const Bootstrap: React.FC = () => {
  const { user } = useUserStore();

  useQuery({
    queryKey: ["search-notes-latest", user?.id],
    queryFn: async () =>
      new SearchNotesApi().search(RestNotesSearchType.LATEST, "", 100, 0),
    enabled: !!user?.id, // don't run when user is not loaded yet
    staleTime: Infinity, // cache forever
  });

  useQuery({
    queryKey: ["user-load"], // load once - there shouldn't be a reason to load a user multiple times
    queryFn: async () => await new UserApi().fetchUser(),
    staleTime: Infinity, // cache forever
  });
  return <></>;
};
