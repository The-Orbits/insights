import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import { send, shouldSend, type BeaconOptions } from "./beacon";

export { ENDPOINT } from "./beacon";
export type SpeedInsightsOptions = BeaconOptions & {
  /** The share of page loads that report, 0 to 1 (1 by default): lower it on a busy site. */
  sampleRate?: number;
};

let started = false;

/** A vital's value as the beacon carries it: CLS to four places, the timings to the millisecond. */
export const valueOf = (m: Pick<Metric, "name" | "value">) => (m.name === "CLS" ? m.value.toFixed(4) : String(Math.round(m.value)));

/**
 * Reports this page load's Core Web Vitals (LCP, INP, CLS, FCP, TTFB) as the browser settles them, against the path it
 * loaded on. Call it once; on the server it does nothing.
 */
export function injectSpeedInsights(opts: SpeedInsightsOptions = {}) {
  if (started || typeof window === "undefined" || !shouldSend(location, opts.debug)) return;
  started = true;
  if (Math.random() >= (opts.sampleRate ?? 1)) return;
  const path = location.pathname;
  const report = (m: Metric) => send({ e: "vital", n: m.name, v: valueOf(m), p: path }, opts);
  onLCP(report);
  onINP(report);
  onCLS(report);
  onFCP(report);
  onTTFB(report);
}

/** For tests: let injectSpeedInsights() start again. */
export function reset() {
  started = false;
}
