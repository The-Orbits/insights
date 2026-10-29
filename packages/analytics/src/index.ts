import { send, shouldSend, type BeaconOptions } from "./beacon";

export { ENDPOINT } from "./beacon";
export type AnalyticsOptions = BeaconOptions;

let options: AnalyticsOptions = {};
let started = false;
let last: string | null = null;

/** Sends a page view for `path` (the current one by default), unless it's the page just counted. */
export function pageview(path = typeof location === "undefined" ? "" : location.pathname) {
  if (!started || !path || path === last) return;
  // The referrer belongs to the visit's first page; later ones are moves within the site.
  const first = last === null;
  last = path;
  send({ e: "pageview", p: path, ...(first && document.referrer ? { r: document.referrer } : {}) }, options);
}

/**
 * Starts counting page views: this one, then each page a single-page app moves to (history.pushState and the back and
 * forward buttons). Call it once, as early as you like; on the server it does nothing.
 */
export function inject(opts: AnalyticsOptions = {}) {
  if (started || typeof window === "undefined" || !shouldSend(location, opts.debug)) return;
  started = true;
  options = opts;
  pageview();
  const push = history.pushState;
  history.pushState = function (...args: Parameters<History["pushState"]>) {
    const result = push.apply(this, args);
    pageview();
    return result;
  };
  window.addEventListener("popstate", () => pageview());
}

/** For tests: forget everything inject() set up. */
export function reset() {
  started = false;
  last = null;
  options = {};
}
