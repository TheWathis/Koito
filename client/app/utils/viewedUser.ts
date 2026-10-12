// Whose listening data the web UI shows. null means "my own" (or, for an
// anonymous visitor, the instance's main profile); "all" means everyone the
// viewer is allowed to see; anything else is a username.
//
// The choice is remembered per logged-in account, so when someone else logs in
// on the same browser (or the session expires), they start on their own stats
// instead of inheriting the previous person's choice.
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "koito_viewed_user";
const API_PREFIX = "/apis/web/v1";

// Endpoints that never depend on whose data is being viewed.
const UNSCOPED = [
  "user",
  "users",
  "family",
  "config",
  "health",
  "export",
  "login",
  "logout",
].map((p) => `${API_PREFIX}/${p}`);

// Username of the logged-in account ("" for an anonymous visitor). Set by the
// app once it knows who is logged in.
let currentOwner = "";

// The viewed profile is stored per account, so it can only be read once the
// logged-in account is known. Route loaders run before the app has rendered,
// so installUserScopedFetch asks the server itself instead of waiting for it.
let viewerKnown!: () => void;
const viewerReady = new Promise<void>((resolve) => (viewerKnown = resolve));

export function setViewer(username: string | null | undefined): void {
  currentOwner = username ?? "";
  viewerKnown();
}

type Stored = { owner: string; viewed: string };

export function getViewedUser(): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored;
    if (stored.owner !== currentOwner) return null;
    // Viewing yourself is the default view.
    if (stored.viewed === currentOwner) return null;
    return stored.viewed || null;
  } catch {
    return null;
  }
}

export function setViewedUser(name: string | null): void {
  try {
    if (name && name !== currentOwner) {
      const stored: Stored = { owner: currentOwner, viewed: name };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // storage can be unavailable (private window); the default view still works
  }
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();

export function subscribeViewedUser(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// getViewedUser, re-rendering the component when the viewed profile changes.
export function useViewedUser(): string | null {
  return useSyncExternalStore(subscribeViewedUser, getViewedUser, () => null);
}

let installed = false;

// Adds ?user=<viewed user> to every read the app makes to the API, so no
// component has to know about user switching. Call it once, before the app
// renders.
export function installUserScopedFetch(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (
      typeof input === "string" &&
      input.startsWith(`${API_PREFIX}/`) &&
      method === "GET"
    ) {
      const [path, query = ""] = input.split("?");
      const unscoped = UNSCOPED.some(
        (p) => path === p || path.startsWith(`${p}/`),
      );
      if (!unscoped) {
        return viewerReady.then(() => {
          const viewed = getViewedUser();
          const params = new URLSearchParams(query);
          if (viewed && !params.has("user")) params.set("user", viewed);
          const qs = params.toString();
          return original(qs ? `${path}?${qs}` : path, init);
        });
      }
    }
    return original(input, init);
  };

  original(`${API_PREFIX}/user`)
    .then((res) => res.json())
    .then((data) => setViewer(data.error ? null : data.username))
    .catch(() => setViewer(null));
}
