import { useEffect } from "react";
import { injectSpeedInsights, type SpeedInsightsOptions } from "./index";

/** Reports Core Web Vitals from wherever it's rendered, once; put it in the root layout. Renders nothing. */
export function SpeedInsights(props: SpeedInsightsOptions) {
  useEffect(() => injectSpeedInsights(props), []);
  return null;
}

export type { SpeedInsightsOptions };
