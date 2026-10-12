import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRevalidator } from "react-router";
import { setViewedUser } from "~/utils/viewedUser";

// Switches whose stats are shown without reloading the page: every read is
// scoped to the viewed profile, so the page's data is loaded again and the
// cached queries are dropped. The list of users is the same for everyone.
export function useSwitchProfile() {
  const queryClient = useQueryClient();
  const revalidator = useRevalidator();
  const navigate = useNavigate();

  return (name: string | null, to?: string) => {
    setViewedUser(name);
    queryClient.resetQueries({
      predicate: (q) => q.queryKey[0] !== "users",
    });
    if (to) navigate(to);
    else revalidator.revalidate();
  };
}
