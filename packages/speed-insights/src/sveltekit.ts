import { browser } from "$app/environment";
import { page } from "$app/stores";
import { svelteKitRoute } from "../../../shared/loader";
import { injectSpeedInsights as start, type SpeedInsightsOptions } from "./index";

export type { BeforeSend, SpeedInsightsOptions } from "./index";

/** Reports Core Web Vitals with the route that served the page. Call it once in the root +layout.ts (or +layout.svelte). */
export function injectSpeedInsights(options: Omit<SpeedInsightsOptions, "route"> = {}) {
  if (!browser) return;
  const started = start(options);
  page.subscribe(({ route }) => started?.setRoute(route.id ? svelteKitRoute(route.id) : null));
}
