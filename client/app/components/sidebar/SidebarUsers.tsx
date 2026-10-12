import { useQuery } from "@tanstack/react-query";
import { getUsers } from "api/api";
import { Users } from "lucide-react";
import { useEffect, useState } from "react";
import UserSwitcherModal from "../modals/UserSwitcherModal";
import SidebarItem from "./SidebarItem";
import { getViewedUser, setViewedUser } from "~/utils/viewedUser";

interface Props {
  size: number;
}

export default function SidebarUsers({ size }: Props) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ["users"], queryFn: getUsers });

  // If the profile that was being viewed was deleted, or its owner made it
  // private, every read would fail: fall back to the default view.
  useEffect(() => {
    const viewed = getViewedUser();
    if (data && viewed && viewed !== "all") {
      if (!data.some((u) => u.username === viewed)) {
        setViewedUser(null);
        window.location.reload();
      }
    }
  }, [data]);

  // A single-user instance has nothing to switch to.
  if (!data || data.length < 2) {
    return null;
  }

  return (
    <SidebarItem
      space={10}
      name="Switch user"
      onClick={() => setOpen(true)}
      modal={<UserSwitcherModal open={open} setOpen={setOpen} />}
    >
      <Users size={size} />
    </SidebarItem>
  );
}
