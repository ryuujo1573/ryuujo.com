# workers/cats-api.js

Cloudflare Worker behind `https://api.ryuujo.com/cats` — the live data source
for the site's `/cats` page.

## What it does

Serves one read-only JSON payload of feeder stats (`xiaomi.feeder.pi2001`) by
querying Home Assistant server-side. The page polls it every 30s (plus a manual
refresh button); the build-time fetch in `src/lib/feeder.ts` remains as the
first-paint snapshot and the fallback when the live endpoint is unreachable.

## Security posture

- Exactly one route: `GET /cats`. Query strings are stripped and never read;
  other paths return 404, other methods 405. No client-supplied value reaches
  Home Assistant, so there is nothing to inject.
- The Home Assistant long-lived token lives only in the Worker's `HA_TOKEN`
  secret binding — never in this file, the repo, or the client bundle.
- All HA entity ids are hardcoded constants (stable Xiaomi spec keys).
- Responses contain feeder stats only; no credentials, ids, or private data.
- `Access-Control-Allow-Origin` reflects only `https://ryuujo.com` (plus the
  local dev origin on port 4399).
- Responses are edge-cached ~20s (`caches.default`); a zone cache rule for
  `api.ryuujo.com` bypasses the CDN so that TTL is honored and browser caching
  stays at 20s instead of the zone default.

## Deploying an update

`POST /accounts/{account_id}/workers/scripts/ryuujo-cats-api/versions` with the
module plus metadata bindings, then
`POST /accounts/{account_id}/workers/scripts/ryuujo-cats-api/deployments` with
`{strategy: "percentage", versions: [{percentage: 100, version_id}]}`.

Notes learned the hard way:

- Upload through the **Versions API**. A plain script `PUT` on this account
  drops metadata bindings (the deployed version ends up with none, and the
  Worker fails with `HA_TOKEN is not defined`).
- The binding must be declared in metadata as
  `{type: "secret_text", name: "HA_TOKEN", text: "<value>"}`; referencing an
  existing secret without `text` is rejected (`error 10021`).
- The token must be read from `env.HA_TOKEN` inside `fetch()` — a module-level
  global does not receive the binding.
- This account does **not** need a `migrations` field; sending one makes the
  upload fail with a Durable Object migration error.

## Rotating the token

Mint a new long-lived token in Home Assistant (Profile → Security → Long-lived
access tokens) or via `auth/long_lived_access_token` over the websocket API, then
redeploy a version with the new `text` value. Revoke the old token in HA to
finish the rotation. The current token is named "ryuujo.com /cats api" in HA
(separate from the build-time token "ryuujo.com /cats page").
