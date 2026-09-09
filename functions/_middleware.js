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
