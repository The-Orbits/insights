import { addScript, isBrowser, isDevelopment, type Mode } from "../../../shared/loader";
import type { SpeedBeforeSend, SpeedEvent } from "../../../shared/types";

export { computeRoute, type Mode } from "../../../shared/loader";
export type { SpeedBeforeSend as BeforeSend, SpeedEvent };

/** Served by Orbits' edge for production deployments of projects with Speed Insights turned on. */
export const SCRIPT = "/_orbits/speed-insights.js";

export interface SpeedInsightsOptions {
  /** "development" measures nothing; "auto" (the default) is development in a dev build or on localhost. */
  mode?: Mode;
  /** Log each report the script sends. */
  debug?: boolean;
  /** The share of page loads that report, from 0 to 1 (1 by default): lower it on a busy site. */
  sampleRate?: number;
  /** Change a report before it's sent, such as to take an ID out of its URL, or return null to drop it. */
  beforeSend?: SpeedBeforeSend;
  /** Where the script is loaded from. */
  scriptSrc?: string;
  /** Where reports go. */
  endpoint?: string;
  /** The route that served this page, such as /blog/[slug]. The framework components set it. */
  route?: string | null;
}

let logged = false;

/**
 * Starts Speed Insights: loads the edge's script, which measures this page load's Core Web Vitals (LCP, INP, CLS, FCP,
 * TTFB) and reports them against its path. Call it once in the browser; on the server it does nothing. setRoute tells
 * it the route, if that's only known later.
 */
export function injectSpeedInsights(options: SpeedInsightsOptions = {}): { setRoute: (route: string | null) => void } | null {
  if (!isBrowser()) return null;
  if (isDevelopment(options.mode)) {
    if (!logged) console.info("[Orbits Speed Insights] Development: nothing is measured or sent.");
    logged = true;
    return null;
  }
  if (!window.osi) window.osi = (...command) => (window.osiq ??= []).push(command);
  if (options.beforeSend) window.osi("beforeSend", options.beforeSend);
  addScript(options.scriptSrc ?? SCRIPT, {
    endpoint: options.endpoint,
    debug: options.debug ? "true" : undefined,
    sampleRate: options.sampleRate === undefined ? undefined : String(options.sampleRate),
    route: options.route ?? undefined,
  }, `[Orbits Speed Insights] Couldn't load ${options.scriptSrc ?? SCRIPT}. It's served once Speed Insights is turned on in your project's Speed Insights tab, for production deployments; an ad blocker may also stop it.`);
  return { setRoute: (route) => window.osi?.("route", route) };
}
