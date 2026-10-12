import { useQuery } from "@tanstack/react-query";
import { getUsers } from "api/api";
import { Link } from "react-router";
import { useAppContext } from "~/providers/AppProvider";
import { getViewedUser, setViewedUser } from "~/utils/viewedUser";
import SubHeader from "../primitives/SubHeader";
import { Modal } from "./Modal";

interface Props {
  open: boolean;
  setOpen: Function;
}

export default function UserSwitcherModal({ open, setOpen }: Props) {
  const { user: me } = useAppContext();
  const viewed = getViewedUser();
  const { data } = useQuery({ queryKey: ["users"], queryFn: getUsers });

  // Every read of the app goes through ?user=..., so the simplest way to show
  // another profile everywhere is to remember the choice and reload.
  const choose = (name: string | null) => {
    setViewedUser(name);
    window.location.reload();
  };

  const row = (label: string, name: string | null, active: boolean) => (
    <button
      key={label}
      onClick={() => choose(name)}
      className={`text-start px-4 py-2 rounded-md hover-bg-secondary ${
        active ? "bg-(--color-bg-secondary) border border-(--color-border)" : ""
      }`}
    >
      {label}
    </button>
  );

  return (
    <Modal h={500} isOpen={open} onClose={() => setOpen(false)} maxW={420}>
      <SubHeader>Whose listens?</SubHeader>
      <div className="flex flex-col gap-1">
        {row(me ? "Mine" : "Default profile", null, viewed === null)}
        {(data ?? [])
          .filter((u) => u.id !== me?.id)
          .map((u) => row(u.username, u.username, viewed === u.username))}
        {row("Everyone", "all", viewed === "all")}
      </div>
      <div className="mt-4">
        <Link to="/family" onClick={() => setOpen(false)} className="underline">
          Family overview →
        </Link>
      </div>
    </Modal>
  );
}
