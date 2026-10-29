import type { AnalyticsBeforeSend, AnalyticsCommand, AnalyticsEvent, EventValue } from "../../../shared/types";
import { automated, ENDPOINT, pathOf, send } from "./beacon";

/** Longest name, property key or string value a custom event keeps, and the most properties. */
export const LIMIT = 255;
export const MAX_PROPERTIES = 20;

/** A custom event's properties as they're sent: flat, at most MAX_PROPERTIES, nothing longer than LIMIT. */
export function cleanData(data: Record<string, unknown> | undefined): Record<string, EventValue> | undefined {
  if (!data) return undefined;
  const out: Record<string, EventValue> = {};
  for (const [key, value] of Object.entries(data)) {
    if (Object.keys(out).length >= MAX_PROPERTIES) break;
    if (key.length > LIMIT) continue;
    if (typeof value === "string") out[key] = value.slice(0, LIMIT);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Counts page views: the first, then each history.pushState and back or forward move, unless the loader turned that
 * off (data-auto-track="false") because the framework reports its own, with the route. Runs the commands the loader
 * queued in window.oaq, then each it sends to window.oa.
 */
export function start(script: HTMLScriptElement | null) {
  const ds = script?.dataset ?? {};
  const endpoint = ds.endpoint || ENDPOINT;
  const debug = ds.debug === "true";
  const skip = automated();
  let beforeSend: AnalyticsBeforeSend | undefined;
  let route = ds.route || undefined;
  let last: string | null = null;

  function emit(event: AnalyticsEvent, fields: Record<string, string>) {
    const out = beforeSend ? beforeSend(event) : event;
    if (!out) {
      if (debug) console.info("[Orbits Analytics] beforeSend dropped", event);
      return;
    }
    if (skip) return;
    const name = out.name?.slice(0, LIMIT);
    const data = cleanData(out.data);
    send(endpoint, {
      ...fields,
      p: pathOf(out.url),
      ...(out.route ? { o: out.route } : {}),
      ...(out.type === "event" && name ? { n: name } : {}),
      ...(out.type === "event" && data ? { d: JSON.stringify(data) } : {}),
    }, debug);
  }

  function pageview(path = location.pathname) {
    if (path === last) return;
    // The referrer belongs to the visit's first page; later ones are moves within the site.
    const first = last === null;
    last = path;
    const url = new URL(path, location.href).href;
    emit({ type: "pageview", url, route }, { e: "pageview", ...(first && document.referrer ? { r: document.referrer } : {}) });
  }

  function run(...[command, arg]: AnalyticsCommand) {
    if (command === "beforeSend") beforeSend = arg;
    else if (command === "pageview") {
      route = arg.route || undefined;
      pageview(arg.path ?? location.pathname);
    } else if (command === "event" && arg.name) {
      emit({ type: "event", url: location.href, route, name: arg.name, data: cleanData(arg.data) }, { e: "event" });
    }
  }

  const queued = window.oaq ?? [];
  window.oa = run;
  window.oaq = [];
  const auto = ds.autoTrack !== "false";
  // beforeSend first, so it sees the first page view.
  for (const c of queued) if (c[0] === "beforeSend") run(...c);
  if (auto) {
    pageview();
    const push = history.pushState;
    history.pushState = function (...args: Parameters<History["pushState"]>) {
      const result = push.apply(this, args);
      pageview();
      return result;
    };
    addEventListener("popstate", () => pageview());
  }
  for (const c of queued) if (c[0] !== "beforeSend") run(...c);
}
