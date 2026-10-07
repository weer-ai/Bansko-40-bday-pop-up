# Ting turns 40 — Bansko, February 2027

One-page invite with a shared skier map. Friends sign up, appear as skiers drifting down the slope, and find each other before they arrive.

Ported from the `Landing.dc.html` prototype (visual and behavioural reference). This is a separate project from Terminal Taiwan.

## Run it

```sh
npm run dev      # http://localhost:3000, with sample skiers so the map is not empty
npm start        # real data only
npm test
```

No dependencies, Node 18+. Static frontend in `public/`, small API in `server.js`.

## Environment

| Var | Purpose |
|---|---|
| `PORT` | default 3000 |
| `ADMIN_TOKEN` | enables moderation endpoints; use a long random string |
| `DATA_FILE` | JSON store path, default `data/skiers.json`. **Put this on a persistent volume.** |
| `SEED_SAMPLE=1` | seed sample skiers when the store is empty (dev only) |

## API

- `GET /api/skiers`: public skiers (never email, token or hidden entries)
- `POST /api/skiers`: sign up. Returns `{ skier, editToken }`. Rate limited, honeypot field `website`
- `PUT /api/skiers/:id` with `X-Edit-Token`: edit your entry
- Moderation, header `Authorization: Bearer $ADMIN_TOKEN`:
  - `GET /api/admin/skiers`: everything, including email and hidden
  - `POST /api/admin/skiers/:id/hide` and `/unhide`
  - `DELETE /api/admin/skiers/:id`

```sh
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://your.site/api/admin/skiers
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" https://your.site/api/admin/skiers/s_abc123/hide
```

## Editing an entry

After signing up, the visitor's browser remembers the entry and the page shows a private edit link (`/#edit=<id>.<token>`). Opening that link on any device reopens the form. Email is stored privately but **no email is sent yet**: wiring a provider (e.g. Resend) to mail the edit link is the remaining step.

## Filling in the placeholders

- Links (WhatsApp, Luma, Valentina Heights booking), photos and the video: `public/config.js`. Put files in `public/media/`.
- Place cards (ski rental, gym, coworking, spa price): the `PLACES` array in `public/app.js`.
- Slope party meeting point and time: not on the page yet.
- Room count: page says ten apartments and studios, as per the latest notes.

## Hosting

### Vercel

`public/` is served as static files and `api/[...path].js` runs the same API code as a function. `vercel.json` sets the output directory.

1. Import the repo in Vercel.
2. Storage tab: add **Upstash Redis** and connect it to the project. This sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or the `UPSTASH_*` equivalents), which the code reads.
3. Settings, Environment Variables: add `ADMIN_TOKEN`.
4. Redeploy. Without a database the API answers 503 with a message saying so.

### Anywhere else

The same code runs as a plain Node server (`npm start`) with a JSON file store, on any host with a persistent disk (Fly.io, Railway, Render). Set `DATA_FILE` to a path on that disk.
