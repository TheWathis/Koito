// Creates the demo family on a fresh Koito started by scripts/demo.sh, and
// gives each person a few weeks of listens through the ListenBrainz API, the
// same way Multi-Scrobbler would.
const BASE = "http://localhost:4110";
const API = `${BASE}/apis/web/v1`;

const family = {
  mathis: {
    visibility: "public",
    music: [
      ["Daft Punk", "Discovery", ["One More Time", "Digital Love", "Harder, Better, Faster, Stronger"]],
      ["Justice", "Cross", ["D.A.N.C.E.", "Genesis", "Phantom"]],
      ["Air", "Moon Safari", ["La Femme d'Argent", "Sexy Boy", "Kelly Watch the Stars"]],
      ["Phoenix", "Wolfgang Amadeus Phoenix", ["1901", "Lisztomania"]],
      ["M83", "Hurry Up, We're Dreaming", ["Midnight City", "Wait"]],
    ],
  },
  clara: {
    visibility: "members",
    music: [
      ["Angèle", "Brol", ["Balance ton quoi", "Tout oublier", "Je veux tes yeux"]],
      ["Clara Luciani", "Cœur", ["Le reste", "Respire encore"]],
      ["Pomme", "Consolation", ["Jardin", "Grandiose"]],
      ["Stromae", "Racine Carrée", ["Papaoutai", "Formidable", "Tous les mêmes"]],
    ],
  },
  leo: {
    visibility: "private",
    music: [
      ["Orelsan", "Civilisation", ["L'odeur de l'essence", "Shonen"]],
      ["PNL", "Dans la légende", ["Au DD", "Naha"]],
      ["Nekfeu", "Feu", ["On verra", "Egérie"]],
      ["Lomepal", "Jeannine", ["Trop beau", "Club"]],
    ],
  },
};

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${API}/health`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Koito did not start within 60 seconds");
}

async function login(username) {
  const r = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "changeme" }),
  });
  if (!r.ok) throw new Error(`login ${username}: ${r.status} ${await r.text()}`);
  return r.headers.get("set-cookie").split(";")[0];
}

// Deterministic pseudo-random numbers, so every reset gives the same demo.
function rng(seed) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
}

function listensFor(name) {
  const rand = rng(name.length * 7919);
  const now = Math.floor(Date.now() / 1000);
  const tracks = family[name].music.flatMap(([artist, album, titles], ai) =>
    titles.map((title) => ({ artist, album, title, weight: family[name].music.length - ai })),
  );
  const pool = tracks.flatMap((t) => Array(t.weight).fill(t));
  const payload = [];
  for (let day = 0; day < 60; day++) {
    if (rand() < 0.2) continue; // some days without music
    const plays = 2 + Math.floor(rand() * 12);
    for (let i = 0; i < plays; i++) {
      const t = pool[Math.floor(rand() * pool.length)];
      payload.push({
        listened_at: now - day * 86400 - Math.floor(rand() * 80000),
        track_metadata: {
          artist_name: t.artist,
          track_name: t.title,
          release_name: t.album,
          additional_info: { duration_ms: 180000 + Math.floor(rand() * 90000), media_player: "demo" },
        },
      });
    }
  }
  return payload;
}

async function submit(name, token) {
  const payload = listensFor(name);
  const r = await fetch(`${BASE}/apis/listenbrainz/1/submit-listens`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
    body: JSON.stringify({ listen_type: "import", payload }),
  });
  if (!r.ok) throw new Error(`listens for ${name}: ${r.status} ${await r.text()}`);
  console.log(`    ${name}: ${payload.length} listens`);
}

await waitForServer();
console.log("==> Creating the demo family");
const admin = await login("mathis");
const keys = await (await fetch(`${API}/user/apikeys`, { headers: { cookie: admin } })).json();
const tokens = { mathis: keys[0].key };

for (const name of ["clara", "leo"]) {
  const r = await fetch(`${API}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: admin },
    body: JSON.stringify({ username: name, password: "changeme", role: "user", visibility: family[name].visibility }),
  });
  if (!r.ok) throw new Error(`create ${name}: ${r.status} ${await r.text()}`);
  tokens[name] = (await r.json()).api_key.key;
  console.log(`    created ${name} (${family[name].visibility})`);
}

console.log("==> Sending listens");
for (const name of Object.keys(family)) await submit(name, tokens[name]);
console.log("==> Demo data ready");
