import { setVisibility, type Visibility } from "api/api";
import { useState } from "react";
import { useAppContext } from "~/providers/AppProvider";
import SubHeader from "../primitives/SubHeader";

const options: { value: Visibility; label: string; hint: string }[] = [
  {
    value: "public",
    label: "Public",
    hint: "Anyone can see your listening history, even without an account.",
  },
  {
    value: "members",
    label: "Members only",
    hint: "Only people who are logged in to this instance can see it.",
  },
  {
    value: "private",
    label: "Private",
    hint: "Only you and the admins can see it.",
  },
];

export default function VisibilitySetting() {
  const { user } = useAppContext();
  const [value, setValue] = useState<Visibility>(user?.visibility ?? "public");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const change = (next: Visibility) => {
    const previous = value;
    setError("");
    setSuccess("");
    setValue(next);
    setVisibility(next)
      .then((r) => {
        if (r.ok) {
          setSuccess("Visibility updated");
        } else {
          setValue(previous);
          r.json().then((body) => setError(body.error));
        }
      })
      .catch((err) => {
        setValue(previous);
        setError(String(err));
      });
  };

  return (
    <>
      <SubHeader>Who can see my listens</SubHeader>
      <div className="flex flex-col gap-2">
        {options.map((o) => (
          <label key={o.value} className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="koito-visibility"
              className="mt-1"
              checked={value === o.value}
              onChange={() => change(o.value)}
            />
            <span>
              <strong>{o.label}</strong>
              <span className="block text-sm text-(--color-fg-secondary)">
                {o.hint}
              </span>
            </span>
          </label>
        ))}
        {success != "" && <p className="success">{success}</p>}
        {error != "" && <p className="error">{error}</p>}
      </div>
    </>
  );
}
