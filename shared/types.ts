// The commands a loader queues for the edge's script (window.oaq, window.osiq) until it has loaded, and the events
// beforeSend sees. Shared by the packages and packages/script, so both sides agree.

export type EventValue = string | number | boolean | null;

export interface AnalyticsEvent {
  type: "pageview" | "event";
  /** The page's address; a rewritten one is sent by its path only. */
  url: string;
  /** The route that served it, such as /blog/[slug], when the framework says. */
  route?: string;
  /** A custom event's. */
  name?: string;
  data?: Record<string, EventValue>;
}
/** Changes an event before it's sent, or drops it by returning null. */
export type AnalyticsBeforeSend = (event: AnalyticsEvent) => AnalyticsEvent | null | undefined | false;

export type AnalyticsCommand =
  | ["beforeSend", AnalyticsBeforeSend]
  | ["pageview", { route?: string | null; path?: string }]
  | ["event", { name: string; data?: Record<string, unknown> }];

export interface SpeedEvent {
  type: "vital";
  url: string;
  route?: string;
}
export type SpeedBeforeSend = (event: SpeedEvent) => SpeedEvent | null | undefined | false;

export type SpeedCommand = ["beforeSend", SpeedBeforeSend] | ["route", string | null];

declare global {
  interface Window {
    oa?: (...command: AnalyticsCommand) => void;
    oaq?: AnalyticsCommand[];
    osi?: (...command: SpeedCommand) => void;
    osiq?: SpeedCommand[];
    /** beforeSend for the Astro components, which can't take a function as a prop. */
    orbitsAnalyticsBeforeSend?: AnalyticsBeforeSend;
    orbitsSpeedInsightsBeforeSend?: SpeedBeforeSend;
  }
}
