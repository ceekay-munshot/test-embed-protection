## Embed Protection

Every dashboard repo must include two Cloudflare Pages files that stop the dashboard from being embedded on third-party sites or opened as a bare URL. Create both in every dashboard repo.

### What this does and does not do

- **Does**: blocks other origins from iframing the dashboard, and redirects anyone who opens the dashboard URL directly in a tab back to the host app.
- **Does not**: authenticate anyone or protect API data. The bearer token from `context.session.token` remains the actual security boundary. `referer` and `sec-fetch-dest` are client-supplied and can be spoofed by non-browser clients, so treat this as embed/brand protection, not access control.

### File 1 — `_headers`

Browser-enforced. Declares which origins may frame the dashboard.

```text
Content-Security-Policy: frame-ancestors 'self' https://chat.muns.io https://devfe.muns.io;
```

### File 2 — `_middleware.js`

Server-enforced. Catches direct-URL access, which CSP cannot cover.

```js
export async function onRequest(context) {
  const request = context.request;

  // Browsers tell the server exactly how the resource is being requested.
  // 'iframe' means it is embedded. 'document' means it is opened in a direct tab.
  const fetchDest = request.headers.get('sec-fetch-dest');
  const referer = request.headers.get('referer') || '';

  const allowedDomains = ['https://chat.muns.io', 'https://devfe.muns.io'];
  const isAllowedReferer = allowedDomains.some(domain => referer.startsWith(domain));

  // If a user tries to open the URL directly, or if a rogue site tries to fetch it:
  if (fetchDest === 'document' || (fetchDest === 'iframe' && !isAllowedReferer)) {
    // Redirect them to your main app, or return a 403 Forbidden response
    return Response.redirect('https://chat.muns.io', 302);
  }

  // Otherwise, allow the page to load normally
  return await context.next();
}
```

### Placement

Do not assume a fixed path. Inspect the repo's build setup and place each file where it satisfies its constraint:

- **`_headers`** must be served from the deployed asset root. It only takes effect if it ends up in the directory Cloudflare Pages publishes. For a project with no build step that is the repo root; for a bundled app it must be somewhere the build copies verbatim into the output directory.
- **`_middleware.js`** must execute as a Cloudflare Pages Function on every request. It must be registered as a Pages Function, not shipped as a static asset.

**Wrong placement fails silently.** There is no build error and no warning — the files sit in the repo looking correct while providing no protection. Always verify after deploying.

### Allowed domains

The domain list is environment-specific. It must list the host origins that actually embed the dashboard. Confirm the correct origins for the target environment instead of assuming the values above; the same list must appear in both files.

### Verification

After deploying, open the dashboard URL directly in a browser tab. It should redirect to the host app. If it loads normally, the middleware is not running and the placement is wrong.
