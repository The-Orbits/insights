// The beacon both packages send: GET /_orbits/e on the site's own host, which Orbits' edge answers and logs. A site
// that isn't on Orbits gets a harmless 404. Nothing is sent from a local host unless `debug` asks for it.

export const ENDPOINT = "/_orbits/e";

export type BeaconOptions = {
  /** Send from localhost too, and log each beacon to the console. */
  debug?: boolean;
  /** Where beacons go; the default is the edge's own path. */
  endpoint?: string;
};

const LOCAL = /^(localhost|127(\.\d+){3}|\[::1\]|0\.0\.0\.0)$|\.local$/;

/** Whether this page should send beacons at all. */
export function shouldSend(location: Pick<Location, "hostname" | "protocol">, debug = false) {
  if (!/^https?:$/.test(location.protocol)) return false;
  return debug || !LOCAL.test(location.hostname);
}

export function beaconUrl(fields: Record<string, string>, endpoint = ENDPOINT) {
  return `${endpoint}?${new URLSearchParams(fields)}`;
}

export function send(fields: Record<string, string>, options: BeaconOptions = {}) {
  const url = beaconUrl(fields, options.endpoint);
  if (options.debug) console.info("[orbits]", fields);
  // keepalive lets a beacon outlive the page it was sent from; no cookies go with it.
  fetch(url, { method: "GET", keepalive: true, credentials: "omit", cache: "no-store" }).catch(() => {});
}
