// worker/index.ts — Cloudflare Workers entry point.
//
// This deployment uses Workers static assets (`wrangler deploy`), so Pages
// Functions do NOT run. `assets.run_worker_first` sends every request here
// first; this Worker applies the same embed protection that
// functions/_middleware.js applies on a Pages deployment, then hands the
// request to the static-asset server.
//
// See .claude/skills/dashboard-skill/reference/embed-protection.md.
// The origin list below must stay identical to the ones in
// functions/_middleware.js and public/_headers.

const ALLOWED_DOMAINS = ["https://chat.muns.io", "https://devfe.muns.io"];
const HOST_APP_URL = "https://chat.muns.io";

const FRAME_ANCESTORS = `frame-ancestors 'self' ${ALLOWED_DOMAINS.join(" ")};`;

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Browsers tell the server exactly how the resource is being requested.
    // 'iframe' means it is embedded. 'document' means it is opened in a direct tab.
    const fetchDest = request.headers.get("sec-fetch-dest");
    const referer = request.headers.get("referer") || "";
    const isAllowedReferer = ALLOWED_DOMAINS.some((domain) => referer.startsWith(domain));

    // If a user tries to open the URL directly, or if a rogue site tries to fetch it:
    if (fetchDest === "document" || (fetchDest === "iframe" && !isAllowedReferer)) {
      return Response.redirect(HOST_APP_URL, 302);
    }

    // Otherwise serve the static asset. `_headers` is applied by the asset
    // server; the CSP is set again here so frame-ancestors is guaranteed on
    // every response even if that file is ever missing from the build output.
    const assetResponse = await env.ASSETS.fetch(request);
    const response = new Response(assetResponse.body, assetResponse);
    response.headers.set("Content-Security-Policy", FRAME_ANCESTORS);
    return response;
  },
};
