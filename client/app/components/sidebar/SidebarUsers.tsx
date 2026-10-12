import { useQuery } from "@tanstack/react-query";
import { getUsers } from "api/api";
import { Users } from "lucide-react";
import SidebarItem from "./SidebarItem";

interface Props {
  size: number;
}

// Link to the family overview. Switching profiles is done from the bar at the
// top of each page, which always says whose stats are shown.
export default function SidebarUsers({ size }: Props) {
  const { data } = useQuery({ queryKey: ["users"], queryFn: getUsers });

  // A single-user instance has no family page to show.
  if (!data || data.length < 2) {
    return null;
  }

  return (
    <SidebarItem
      space={10}
      to="/family"
      name="Family"
      onClick={() => {}}
      modal={<></>}
    >
      <Users size={size} />
    </SidebarItem>
  );
}
