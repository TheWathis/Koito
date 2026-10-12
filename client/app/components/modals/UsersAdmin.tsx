import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createUser,
  deleteUser,
  getUsers,
  type CreatedUser,
  type Visibility,
} from "api/api";
import { Trash } from "lucide-react";
import { useState } from "react";
import { useAppContext } from "~/providers/AppProvider";
import { AsyncButton } from "../AsyncButton";
import SubHeader from "../primitives/SubHeader";

export default function UsersAdmin() {
  const { user: me } = useAppContext();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [visibility, setVisibility] = useState<Visibility>("members");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedUser | null>(null);

  const { isPending, isError, data, error: loadError } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  if (me?.role !== "admin") {
    return <p>Only admins can manage users.</p>;
  }
  if (isError) {
    return <p className="error">Error: {loadError.message}</p>;
  }
  if (isPending) {
    return <p>Loading...</p>;
  }

  const create = () => {
    setError("");
    setCreated(null);
    if (username === "" || password === "") {
      setError("a username and a password are required");
      return;
    }
    setLoading(true);
    createUser(username, password, role, visibility)
      .then((r) => {
        setCreated(r);
        setUsername("");
        setPassword("");
        queryClient.invalidateQueries({ queryKey: ["users"] });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const remove = (id: number) => {
    setError("");
    setLoading(true);
    deleteUser(id)
      .then((r) => {
        if (r.ok) {
          queryClient.invalidateQueries({ queryKey: ["users"] });
        } else {
          r.json().then((body) => setError(body.error));
        }
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <SubHeader>Users</SubHeader>
        <div className="flex flex-col gap-2">
          {data.map((u) => (
            <div key={u.id} className="flex gap-2 items-center">
              <div className="bg p-3 rounded-md flex-grow">
                <strong>{u.username}</strong>
                <span className="text-sm text-(--color-fg-secondary)">
                  {" "}
                  · {u.role} · {u.visibility}
                </span>
              </div>
              {u.id !== me.id && (
                <AsyncButton
                  loading={loading}
                  onClick={() => remove(u.id)}
                  confirm
                  danger
                >
                  <Trash size={16} />
                </AsyncButton>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <SubHeader>Add a user</SubHeader>
        <form
          action="#"
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col gap-3"
        >
          <div className="flex gap-3">
            <input
              name="koito-new-username"
              type="text"
              placeholder="Username"
              className="w-full fg bg rounded p-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              name="koito-new-password"
              type="password"
              placeholder="Password (8+ characters)"
              className="w-full fg bg rounded p-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <select
              className="fg bg rounded p-2"
              value={role}
              onChange={(e) => setRole(e.target.value as "user" | "admin")}
            >
              <option value="user">Regular user</option>
              <option value="admin">Admin</option>
            </select>
            <select
              className="fg bg rounded p-2"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
            >
              <option value="public">Public profile</option>
              <option value="members">Members only</option>
              <option value="private">Private</option>
            </select>
            <AsyncButton loading={loading} onClick={create}>
              Create
            </AsyncButton>
          </div>
        </form>
        {error != "" && <p className="error mt-2">{error}</p>}
        {created && (
          <div className="mt-3 flex flex-col gap-1">
            <p className="success">
              Created <strong>{created.user.username}</strong>. Use this API key
              as the token in their Multi-Scrobbler Koito client:
            </p>
            <code className="bg p-3 rounded-md select-all break-all">
              {created.api_key.key}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}
