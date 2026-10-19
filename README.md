# FourTing's Birthday — Bansko, 6–20 February 2027

One-page invite: a flat vermilion-and-cobalt poster of a ski slope. Friends sign up and appear as a skier, snowboarder or walker coming down the shared slope, so they can see each other before they arrive. The big day is Friday 12 February; Ting pays everyone's ski pass that day.

Ported from the `FourTing.dc.html` prototype (visual and behavioural reference). This is a separate project from Terminal Taiwan.

## Run it

```sh
npm run dev      # http://localhost:3000, with sample riders so the slope is not empty
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

- `GET /api/skiers`: public skiers (never email, token, ski-pass or extra-bag answers, or hidden entries)
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

## Sign-up fields

The `skiers` table and the API did not change shape: each entry is one JSON document, so the new fields needed no migration, and entries saved by the previous design still load (the page falls back for the fields they lack).

| Field | Notes |
|---|---|
| `name`, `msg` | required name; speech bubble text (the form limits it to 60 characters, the API to 140) |
| `type` | `skier`, `board` or `walker` |
| `jacket`, `hat` | colours from a fixed list (`hat` is the helmet) |
| `rel` | "Who are you to Ting?" in the person's own words. The crowd (`from`) is derived from keywords in it (amsterdam, delft, bansko/neighbour, taiwan, nomad), otherwise `other` |
| `arrive`, `leave` | days in February 2027, 6 to 20 |
| `where` | Valentina Heights / My own place in Bansko / A hotel in town / Still deciding |
| `photo` | optional square JPEG data URL, at most 16,000 characters. The page crops and compresses it in the browser |
| `email` | optional, private |
| `pass` | private: `yes` (Ting pays the pass on the 12th), `self`, `no` |
| `bag` | private: offered to check an extra bag of Ting's things |

Photos are sent inline with the list, so the list grows by roughly 10 KB per photo. That is fine for a few hundred people; Vercel limits a function response to 4.5 MB, so past that point move the photos to Supabase Storage.

## Ting's private view

The admin list includes everything: email, `pass`, `bag`, hidden entries.

```sh
A="Authorization: Bearer $ADMIN_TOKEN"; U=https://your.site/api/admin/skiers
curl -s -H "$A" $U | jq '[.[] | select(.pass=="yes" and (.hidden|not))] | length'               # ski passes to pay for on the 12th
curl -s -H "$A" $U | jq -r '.[] | select(.bag and (.hidden|not)) | .name'                      # who offered to carry an extra bag
curl -s -H "$A" $U | jq -r '.[] | select(.email != "") | "\(.name)\t\(.email)"'              # contact details
```

## Editing an entry

After signing up, the visitor's browser remembers the entry and the page shows a private edit link (`/#edit=<id>.<token>`) with a copy button. Opening that link on any device reopens the form; on the same browser, the Join the slope sign opens straight into edit mode. Email is stored privately but **no email is sent yet**: wiring a provider (e.g. Resend) to mail the edit link is the remaining step.

## Filling in the placeholders

- Links (WhatsApp, Luma, Valentina Heights booking): `public/config.js`. While a link is empty its button is greyed out with a `[... LINK]` note (Luma stays hidden). "Add to calendar" is generated in the browser as an `.ics`, no link needed.
- Text still to confirm (ski rental partner and pop-up rate, Grand Hotel Therme time and entry price, coworking and gym names and prices, second-person price at Valentina Heights): bracketed placeholders in the panels in `public/index.html`. Search for `[`.
- Prices to re-check before launch: the bus price and timetable came from a travel blog, and 2026/27 lift prices are not published yet (last season's day pass was about €56).
- How busy the slope looks: `sim.maxRiders` and `sim.speed` in `public/config.js`.
- The riders on the slope are real sign-ups plus Ting as the host. `npm run dev` adds sample riders so the slope is not empty while developing; they are never created in production.
- `public/media/` holds photos from the previous design. The page does not use them.

## Hosting

### Vercel

`public/` is served as static files and `api/[...path].js` runs the same API code as a function. `vercel.json` sets the output directory.

1. Import the repo in Vercel.
2. Supabase: create a project, then run `supabase/schema.sql` in the SQL Editor (creates the `skiers` table with row level security on and no policies, so the public key can read nothing).
3. Vercel, Settings, Environment Variables: add `SUPABASE_URL` (Project URL) and `SUPABASE_SERVICE_ROLE_KEY` (the secret / service_role key; never expose it in the browser), plus `ADMIN_TOKEN`. The Vercel Supabase integration can set the first two for you.
4. Redeploy. Without a database the API answers 503 with a message saying so.

### Anywhere else

The same code runs as a plain Node server (`npm start`) with a JSON file store, on any host with a persistent disk (Fly.io, Railway, Render). Set `DATA_FILE` to a path on that disk.
