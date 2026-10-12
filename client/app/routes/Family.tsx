import { useQuery } from "@tanstack/react-query";
import { getFamily, type FamilyMember } from "api/api";
import SubHeader from "~/components/primitives/SubHeader";
import { setViewedUser } from "~/utils/viewedUser";

export function meta() {
  return [{ title: "Family - Koito" }];
}

function openProfile(name: string) {
  setViewedUser(name);
  window.location.assign("/");
}

function Member({ m }: { m: FamilyMember }) {
  return (
    <div className="bg p-4 rounded-md flex flex-col gap-2 min-w-64">
      <div className="flex items-baseline justify-between gap-4">
        <h3>{m.user.username}</h3>
        <span className="text-sm text-(--color-fg-secondary)">
          {m.user.visibility}
        </span>
      </div>
      {m.now_playing && (
        <p className="text-sm">
          Now playing: <strong>{m.now_playing.title}</strong>
          {m.now_playing.artists?.length > 0 &&
            ` · ${m.now_playing.artists.map((a) => a.name).join(", ")}`}
        </p>
      )}
      <dl className="grid grid-cols-2 gap-x-4 text-sm">
        <dt className="text-(--color-fg-secondary)">This week</dt>
        <dd>
          {m.listens_week} plays · {m.minutes_week} min
        </dd>
        <dt className="text-(--color-fg-secondary)">All time</dt>
        <dd>{m.listens_all_time} plays</dd>
        {m.top_artist_week && (
          <>
            <dt className="text-(--color-fg-secondary)">Top artist this week</dt>
            <dd>{m.top_artist_week.name}</dd>
          </>
        )}
      </dl>
      <button
        onClick={() => openProfile(m.user.username)}
        className="large-button mt-2 self-start"
      >
        View listens
      </button>
    </div>
  );
}

export default function Family() {
  const { isPending, isError, data, error } = useQuery({
    queryKey: ["family"],
    queryFn: getFamily,
  });

  return (
    <div className="flex flex-col items-center mx-auto pt-12 sm:pt-0 w-full px-4 sm:px-0">
      <div className="w-full sm:w-4/5 max-w-4xl mt-8">
        <SubHeader>Family</SubHeader>
        {isPending && <p>Loading...</p>}
        {isError && <p className="error">Error: {error.message}</p>}
        {data && data.length === 0 && <p>No one to show yet.</p>}
        <div className="flex flex-wrap gap-4">
          {data?.map((m) => <Member key={m.user.id} m={m} />)}
        </div>
      </div>
    </div>
  );
}
