// What both packages share: they're loaders. The code that measures and sends lives in the scripts Orbits' edge serves
// at /_orbits/analytics.js and /_orbits/speed-insights.js (packages/script), only for production deployments of projects
// that turned the feature on, so it can change without anyone updating a package. tsup bundles this file into each.

export type Mode = "auto" | "production" | "development";

// Bundlers replace process.env.NODE_ENV; the published types mustn't need Node's.
declare const process: { env: Record<string, string | undefined> };

const LOCAL = /^(localhost|127(\.\d+){3}|\[::1\]|0\.0\.0\.0)$|\.local$/;

export const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

/** "auto" is development under a development build or on a local host, production everywhere else. */
export function isDevelopment(mode: Mode = "auto") {
  if (mode !== "auto") return mode === "development";
  try {
    const env = process.env.NODE_ENV;
    if (env === "development" || env === "test") return true;
  } catch {
    // No bundler replaced process.env: decided by the host alone.
  }
  return isBrowser() && LOCAL.test(location.hostname);
}

/** Adds the edge's script to <head> once, with its settings as data attributes; the one already there otherwise. */
export function addScript(src: string, dataset: Record<string, string | undefined>, failed: string): HTMLScriptElement {
  const existing = document.head.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing) return existing;
  const script = document.createElement("script");
  script.src = src;
  script.defer = true;
  for (const [key, value] of Object.entries(dataset)) if (value !== undefined) script.dataset[key] = value;
  script.onerror = () => console.log(failed);
  document.head.appendChild(script);
  return script;
}

/**
 * The route a path was served by: each parameter's value replaced by its name, `/blog/hello` with { slug: "hello" }
 * as `/blog/[slug]`, and a catch-all's segments as `[...name]`. The path itself without parameters.
 */
export function computeRoute(pathname: string | null, params: Record<string, string | string[]> | null | undefined): string | null {
  if (!pathname || !params) return pathname;
  let route = pathname;
  try {
    const entries = Object.entries(params);
    for (const [key, value] of entries) {
      if (typeof value === "string" && value) route = route.replace(segment(value), `/[${key}]`);
    }
    for (const [key, value] of entries) {
      if (Array.isArray(value) && value.length) route = route.replace(segment(value.join("/")), `/[...${key}]`);
    }
    return route;
  } catch {
    return pathname;
  }
}

/** SvelteKit's route id less its groups: /(shop)/products/[id] is /products/[id]. */
export const svelteKitRoute = (id: string) => id.replace(/\/\([^)]+\)/g, "") || "/";

const segment = (value: string) => new RegExp(`/${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[/?#]|$)`);
