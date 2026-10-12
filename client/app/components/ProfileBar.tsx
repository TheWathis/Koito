import { useQuery } from "@tanstack/react-query";
import { getUsers, type User } from "api/api";
import { ChevronDown, Check, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { useAppContext } from "~/providers/AppProvider";
import { useViewedUser } from "~/utils/viewedUser";
import { useSwitchProfile } from "~/hooks/useSwitchProfile";

function Avatar({ name, other }: { name: string; other?: boolean }) {
  return (
    <span
      aria-hidden
      className={`shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold uppercase ${
        other
          ? "bg-(--color-accent) text-(--color-bg)"
          : "bg-(--color-bg-tertiary) text-(--color-fg)"
      }`}
    >
      {name.slice(0, 1)}
    </span>
  );
}

/**
 * Says, on every page, whose listening stats are on screen. Hidden on
 * single-user instances, where there is never any doubt.
 */
export default function ProfileBar() {
  const { user: me } = useAppContext();
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const viewed = useViewedUser();
  const switchProfile = useSwitchProfile();
  const choose = (name: string | null) => {
    setOpen(false);
    switchProfile(name);
  };
  const location = useLocation();

  // The viewed profile was deleted or made private: go back to the default.
  useEffect(() => {
    if (users && viewed && viewed !== "all") {
      if (!users.some((u) => u.username === viewed)) choose(null);
    }
  }, [users, viewed]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!users || users.length < 2) return null;
  // The family page shows everyone side by side and labels each person itself.
  if (location.pathname === "/family") return null;

  // Who the default view shows: the logged-in user, or (for a visitor) the
  // instance's main profile, i.e. the first admin.
  const defaultProfile: User | undefined =
    (me && users.find((u) => u.id === me.id)) ||
    users.find((u) => u.role === "admin");

  const isAll = viewed === "all";
  const shown = isAll
    ? undefined
    : viewed
      ? users.find((u) => u.username === viewed)
      : defaultProfile;
  const isMine = !!me && !isAll && shown?.id === me.id;
  const isOther = !isMine && !!me;

  let label: React.ReactNode;
  if (isAll) {
    label = (
      <>
        Combined stats of <strong>everyone</strong>
        <span className="text-(--color-fg-secondary)">
          {" "}
          · {users.length} people
        </span>
      </>
    );
  } else if (isMine) {
    label = (
      <>
        <strong>Your</strong> stats
        <span className="text-(--color-fg-secondary)"> · {me!.username}</span>
      </>
    );
  } else if (me) {
    // On a phone the name is what matters, so the sentence is shortened rather
    // than letting the username be cut off.
    label = (
      <>
        <span className="hidden sm:inline">You're viewing </span>
        <span className="sm:hidden">Viewing </span>
        <strong>{shown?.username}</strong>
        <span className="hidden sm:inline">'s stats</span>
      </>
    );
  } else {
    label = (
      <>
        <strong>{shown?.username}</strong>'s stats
      </>
    );
  }

  const options: { key: string; label: string; value: string | null }[] = [
    ...(me ? [{ key: "me", label: `Mine (${me.username})`, value: null }] : []),
    ...users
      .filter((u) => u.id !== me?.id)
      .map((u) => ({
        key: `u${u.id}`,
        label: u.username,
        value: !me && u.id === defaultProfile?.id ? null : u.username,
      })),
    { key: "all", label: "Everyone combined", value: "all" },
  ];
  const activeKey = isAll
    ? "all"
    : isMine
      ? "me"
      : shown
        ? `u${shown.id}`
        : "";

  return (
    <div className="w-full px-4 sm:px-10 pt-4">
      <div
        ref={ref}
        className="relative max-w-[1400px] mx-auto flex items-center gap-3 rounded-(--border-radius) px-3 py-2 border"
        style={
          isOther || isAll
            ? {
                // Someone else's stats: tinted with the theme accent so it is
                // impossible to mistake for your own page.
                borderColor: "var(--color-accent)",
                background:
                  "color-mix(in srgb, var(--color-accent) 12%, var(--color-bg))",
              }
            : { borderColor: "var(--color-bg-tertiary)" }
        }
      >
        {isAll ? (
          <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-(--color-accent) text-(--color-bg)">
            <Users size={16} />
          </span>
        ) : (
          <Avatar name={shown?.username ?? "?"} other={isOther} />
        )}
        <p className="grow min-w-0 truncate">{label}</p>

        {isOther && (
          <button
            onClick={() => choose(null)}
            className="hidden sm:inline-block text-sm px-3 py-1.5 rounded-md hover:bg-(--color-bg-tertiary) underline-offset-2 hover:underline"
          >
            Back to mine
          </button>
        )}
        <button
          onClick={() => setOpen(!open)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="shrink-0 inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-(--color-bg-tertiary) bg-(--color-bg) hover:bg-(--color-bg-tertiary)"
        >
          Switch <ChevronDown size={14} />
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute right-2 top-full mt-2 z-40 w-64 rounded-(--border-radius) border border-(--color-bg-tertiary) bg-(--color-bg) shadow-lg p-1"
          >
            {options.map((o) => (
              <button
                key={o.key}
                role="option"
                aria-selected={o.key === activeKey}
                onClick={() => choose(o.value)}
                className="w-full flex items-center justify-between gap-2 text-start px-3 py-2 rounded-md hover:bg-(--color-bg-tertiary)"
              >
                <span className="truncate">{o.label}</span>
                {o.key === activeKey && <Check size={14} />}
              </button>
            ))}
            <div className="border-t border-(--color-bg-tertiary) mt-1 pt-1">
              <Link
                to="/family"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 rounded-md text-sm text-(--color-fg-secondary) hover:bg-(--color-bg-tertiary) hover:text-(--color-fg)"
              >
                Family overview →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
