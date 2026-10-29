import { useEffect } from "react";
import { inject, pageview, type AnalyticsOptions } from "./index";

export { track, type AnalyticsOptions, type BeforeSend } from "./index";

export type AnalyticsProps = AnalyticsOptions & {
  /** The page's path, with route: counted again whenever either changes. */
  path?: string | null;
};

/** Counts page views from wherever it's rendered, once; put it in the root layout. Renders nothing. */
export function Analytics(props: AnalyticsProps) {
  useEffect(() => {
    if (props.beforeSend) window.oa?.("beforeSend", props.beforeSend);
  }, [props.beforeSend]);
  useEffect(() => inject(props), []);
  useEffect(() => {
    if (props.route && props.path) pageview({ route: props.route, path: props.path });
  }, [props.route, props.path]);
  return null;
}
