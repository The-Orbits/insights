import { browser } from "$app/environment";
import { page } from "$app/stores";
import { svelteKitRoute } from "../../../shared/loader";
import { inject, pageview, type AnalyticsOptions } from "./index";

export { track, type AnalyticsOptions, type BeforeSend } from "./index";

/**
 * Counts page views with the route that served each one. Call it once in the root +layout.ts (or +layout.svelte); it
 * does nothing on the server.
 */
export function injectAnalytics(options: Omit<AnalyticsOptions, "route" | "autoTrack"> = {}) {
  if (!browser) return;
  inject({ ...options, autoTrack: false });
  page.subscribe(({ route, url }) => pageview({ route: route.id ? svelteKitRoute(route.id) : null, path: url.pathname }));
}
