import { useEffect } from "react";
import { inject, type AnalyticsOptions } from "./index";

/** Counts page views from wherever it's rendered, once; put it in the root layout. Renders nothing. */
export function Analytics(props: AnalyticsOptions) {
  useEffect(() => inject(props), []);
  return null;
}

export type { AnalyticsOptions };
