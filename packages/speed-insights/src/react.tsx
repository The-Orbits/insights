import { useEffect, useRef } from "react";
import { injectSpeedInsights, type SpeedInsightsOptions } from "./index";

export type { BeforeSend, SpeedInsightsOptions } from "./index";

/** Reports Core Web Vitals from wherever it's rendered, once; put it in the root layout. Renders nothing. */
export function SpeedInsights(props: SpeedInsightsOptions) {
  const setRoute = useRef<((route: string | null) => void) | null>(null);
  useEffect(() => {
    if (props.beforeSend) window.osi?.("beforeSend", props.beforeSend);
  }, [props.beforeSend]);
  useEffect(() => {
    setRoute.current = injectSpeedInsights(props)?.setRoute ?? null;
  }, []);
  useEffect(() => {
    if (props.route !== undefined) setRoute.current?.(props.route);
  }, [props.route]);
  return null;
}
