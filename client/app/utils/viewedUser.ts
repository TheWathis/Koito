// Whose listening data the web UI shows. null means "my own" (or, for an
// anonymous visitor, the instance's main profile); "all" means everyone the
// viewer is allowed to see; anything else is a username.
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

export function getViewedUser(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setViewedUser(name: string | null): void {
  try {
    if (name) {
      window.localStorage.setItem(STORAGE_KEY, name);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // storage can be unavailable (private window); the default view still works
  }
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
      const viewed = getViewedUser();
      const [path, query = ""] = input.split("?");
      const unscoped = UNSCOPED.some((p) => path === p || path.startsWith(`${p}/`));
      if (viewed && !unscoped) {
        const params = new URLSearchParams(query);
        if (!params.has("user")) params.set("user", viewed);
        input = `${path}?${params.toString()}`;
      }
    }
    return original(input, init);
  };
}
