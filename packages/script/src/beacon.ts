// The beacon both scripts send: GET /_orbits/e on the site's own host, which Orbits' edge answers and logs, and Vector
// reads into ClickHouse. Its query string is the event (see infra/logs/vector.yaml in orbits-backend).

export const ENDPOINT = "/_orbits/e";

export function send(endpoint: string, fields: Record<string, string>, debug: boolean) {
  if (debug) console.info("[Orbits]", fields);
  // keepalive lets a beacon outlive the page it was sent from; no cookies go with it.
  fetch(`${endpoint}?${new URLSearchParams(fields)}`, { method: "GET", keepalive: true, credentials: "omit", cache: "no-store" }).catch(() => {});
}

/** Browsers driven by a script (tests, crawlers that run JavaScript, our own screenshots) aren't visitors. */
export const automated = () => navigator.webdriver === true || /Headless/i.test(navigator.userAgent);

/** The path of a URL that beforeSend may have rewritten; the page's own if it isn't one. */
export function pathOf(url: string) {
  try {
    return new URL(url, location.href).pathname;
  } catch {
    return location.pathname;
  }
}
