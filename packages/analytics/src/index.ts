import { addScript, isBrowser, isDevelopment, type Mode } from "../../../shared/loader";
import type { AnalyticsBeforeSend, AnalyticsEvent, EventValue } from "../../../shared/types";

export { computeRoute, type Mode } from "../../../shared/loader";
export type { AnalyticsBeforeSend as BeforeSend, AnalyticsEvent, EventValue };

/** Served by Orbits' edge for production deployments of projects with Analytics turned on. */
export const SCRIPT = "/_orbits/analytics.js";

export interface AnalyticsOptions {
  /** "development" logs instead of sending; "auto" (the default) is development in a dev build or on localhost. */
  mode?: Mode;
  /** Log each page view and event the script sends. */
  debug?: boolean;
  /** Change an event before it's sent, such as to take an ID out of its URL, or return null to drop it. */
  beforeSend?: AnalyticsBeforeSend;
  /** Where the script is loaded from. */
  scriptSrc?: string;
  /** Where page views and events go. */
  endpoint?: string;
  /** The route that served this page, such as /blog/[slug]. Set by the framework components; it turns off autoTrack. */
  route?: string | null;
  /** Count a page view on each history.pushState and back or forward move (true unless a route is given). */
  autoTrack?: boolean;
}

function queue() {
  if (window.oa) return;
  window.oa = (...command) => (window.oaq ??= []).push(command);
}

let logged = false;

/**
 * Starts Analytics: loads the edge's script, which counts this page view and each one after it. Call it once, in code
 * that runs in the browser; on the server it does nothing.
 */
export function inject(options: AnalyticsOptions = {}) {
  if (!isBrowser()) return;
  if (isDevelopment(options.mode)) {
    if (!window.oa) {
      window.oa = (command, arg) => {
        if (command !== "beforeSend" && options.debug !== false) console.info(`[Orbits Analytics] ${command}`, arg);
      };
    }
    if (!logged) console.info("[Orbits Analytics] Development: page views and events are logged here, not sent.");
    logged = true;
    return;
  }
  queue();
  if (options.beforeSend) window.oa!("beforeSend", options.beforeSend);
  const autoTrack = options.autoTrack ?? options.route === undefined;
  addScript(options.scriptSrc ?? SCRIPT, {
    endpoint: options.endpoint,
    debug: options.debug ? "true" : undefined,
    autoTrack: autoTrack ? undefined : "false",
    route: options.route ?? undefined,
  }, `[Orbits Analytics] Couldn't load ${options.scriptSrc ?? SCRIPT}. It's served once Analytics is turned on in your project's Analytics tab, for production deployments; an ad blocker may also stop it.`);
}

/**
 * Records a custom event, such as "Signed up" or "Checkout", with up to 20 flat properties (strings, numbers,
 * booleans or null). Call it in the browser after inject().
 */
export function track(name: string, properties?: Record<string, EventValue>) {
  if (!isBrowser()) {
    console.warn("[Orbits Analytics] track() runs in the browser; on the server it does nothing.");
    return;
  }
  queue();
  window.oa!("event", { name, data: properties });
}

/** Counts a page view yourself, with the route that served it: for frameworks that report their own navigations. */
export function pageview({ route, path }: { route?: string | null; path?: string }) {
  if (!isBrowser()) return;
  queue();
  window.oa!("pageview", { route, path });
}
