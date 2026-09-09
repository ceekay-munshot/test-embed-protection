# AI Analyst & Live Quote — Munshot embedded dashboard

An embedded Munshot dashboard that pairs a **live stock quote** with an **LLM chat
analyst**. Every question the analyst answers is grounded in the quote showing on
screen at that moment.

Built to the standards in `.claude/skills/dashboard-skill/` (read-only reference):
`ui-standards.md`, `auth-standards.md`, `datasource-registry.md`, `embed-protection.md`.

---

## What it does

- Polls the live quote for the ticker the Munshot host has selected, every 5s.
- Builds a live price trace from those samples (session-local, not historical data).
- Shows market cap, P/E, volume and the day move as KPI cards.
- Loads the company profile once per ticker.
- Streams AI answers token-by-token, with the current price, day range, market cap,
  P/E, volume and sector injected into the prompt as context.
- Shows where every number and answer came from in a source-trail widget.

## Datasources

Only datasources registered in `datasource-registry.md` are used. Both are called
with the host-issued JWT (`Authorization: Bearer ${session.token}`).

| Datasource  | Call                                          | Used for                          | Limit  |
| ----------- | --------------------------------------------- | --------------------------------- | ------ |
| `stock_data`| `POST https://fastapi.muns.io/stock-data`      | `stockquote` (polled), `detailquote` (once per ticker) | 60 rpm |
| `llm_chat`  | `POST https://fastapi.muns.io/query-router`    | Streaming NDJSON completions      | 30 rpm |

`stock_data` returns plain-text `key=value` pairs rather than JSON; `src/lib/api.ts`
parses that shape (values may contain commas, keys may start with a digit) and
tolerates a JSON body if one ever appears.

The quote poll runs every **5s** — comfortably above the registry's 3s floor and
well under 60 rpm even with the profile request.

## Host integration

Follows `auth-standards.md` exactly. In particular:

- The SDK is a **classic** `<script>` in `<head>` (no `type="module"`, `async` or `defer`).
- `src/lib/sdk.ts` creates **one** client at module load; `autoReady` is left at its
  default and **`sdk.ready()` is never called manually**.
- Context is read through `useHostContext` (`getContext()` + re-sync on `onMessage`).
- `dashboard.capture.visual` returns a PNG `Blob` of `#dashboard-main`, stepping the
  pixel ratio down if needed to stay under the SDK's 512 KB payload cap.
- `dashboard.capture.snapshot` returns bounded `{ context, selection, data }` (~1.5 KB).
- Neither handler can throw; both return structured, cloneable values.

There is no standalone auth: no login screen, no stored credentials, no hardcoded
token or ticker.

## States

| State | Where it shows |
| --- | --- |
| Loading | Shimmer skeletons in every widget on first load |
| Refreshing | Previous quote stays on screen while the next poll runs |
| Waiting for session | In-widget notice while `session.token` is `null` — never a full-page error |
| No ticker | Empty state; no ticker-bound API calls are made. Chat stays usable |
| Partial | Amber banner naming the feed that failed; healthy widgets keep rendering |
| Error | Centred, friendly message with a retry — never a stack trace |

## Project layout

```
index.html               SDK script tag (classic, in <head>)
src/lib/sdk.ts           SDK client singleton (per auth-standards §3)
src/hooks/useHostContext.ts  session + market context (per auth-standards §4)
src/lib/api.ts           stock_data + llm_chat clients, key=value parser
src/Dashboard.tsx        3-zone shell, widgets, capture handlers
src/components/          WidgetCard, states, KPI, chat, sparkline, source trail
public/_headers          frame-ancestors CSP -> copied to dist/ root by Vite
functions/_middleware.js Pages Function: direct-URL and rogue-iframe redirect
wrangler.jsonc           Cloudflare Pages static-assets config
```

## Local development

```bash
npm install
npm run dev          # http://localhost:5173
```

Outside the Munshot host the SDK global is absent, so the adapter falls back to its
no-op client and every widget shows "Waiting for session…". That is expected.

```bash
npm run build        # tsc --noEmit && vite build — must pass with no type errors
npm run typecheck    # types only
```

## Deploy (Cloudflare Pages)

`wrangler.jsonc` sets `pages_build_output_dir: "./dist"`, so Wrangler publishes
`dist/` as static assets and compiles `functions/_middleware.js` into a Pages
Function automatically.

**First deploy**

```bash
npm install
npm run build
npx wrangler login                       # once per machine
npx wrangler pages project create munshot-ai-analyst-live-quote --production-branch main
npx wrangler pages deploy                # uses wrangler.jsonc; no directory argument needed
```

**Subsequent deploys**

```bash
npm run build && npx wrangler pages deploy
```

**Or via the Cloudflare dashboard** (Workers & Pages → Create → Pages → Connect to Git):

- Build command: `npm run build`
- Build output directory: `dist`
- Functions directory: `functions` (detected automatically)
- Node version: 20 or newer

**Preview locally with the Function and headers active**

```bash
npm run build && npx wrangler pages dev dist
```

### Post-deploy checklist

1. **Embed protection — direct URL.** Open the deployed URL in a browser tab. It must
   redirect to `https://chat.muns.io`. If it loads normally, `_middleware.js` is not
   running and the placement is wrong.
2. **Embed protection — CSP.** `curl -sD- https://<your-deployment>/ | grep -i content-security-policy`
   must return `frame-ancestors 'self' https://chat.muns.io https://devfe.muns.io;`.
3. **Allowed origins.** The domain list is environment-specific and appears in **both**
   `public/_headers` and `functions/_middleware.js`. Confirm the host origins for the
   target environment and keep the two lists identical.
4. **CORS allowlist (host-side).** The deployed domain must be CORS-allowlisted on the
   Munshot APIs (`fastapi.muns.io`) or every request will fail even though the host
   forwards the token correctly. Coordinate this with the platform team.
5. **Register the dashboard** with the host using `dashboardId: "ai-analyst-live-quote"`.
6. **In the host**, select a ticker and confirm the quote populates, the trace builds
   after a few polls, and the analyst streams an answer.
