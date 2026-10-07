# Ting turns 40 — Bansko, February 2027

One-page invite with a shared skier map. Friends sign up, appear as skiers drifting down the slope, and find each other before they arrive.

Ported from the `Landing.dc.html` prototype (visual and behavioural reference). This is a separate project from Terminal Taiwan.

**Status:** written but not yet run. The first session's shell was unavailable, so `npm test` and a browser check are still to do.

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

The server is a plain Node HTTP server with a file store, so it runs on any Node host with a persistent disk (Fly.io, Railway, Render). On serverless/edge hosts, swap `lib/store.js` for a hosted DB; keep the `list/get/create/update/remove` interface. Terminal Taiwan's deploy setup was not available to reuse here.
