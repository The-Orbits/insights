import { onCLS, onFCP, onINP, onLCP, onTTFB, type MetricWithAttribution } from "web-vitals/attribution";
import type { SpeedBeforeSend, SpeedCommand } from "../../../shared/types";
import { automated, ENDPOINT, pathOf, send } from "./beacon";

type Metric = Pick<MetricWithAttribution, "name" | "value" | "attribution">;

/** A vital's value as the beacon carries it: CLS to four places, the timings to the millisecond. */
export const valueOf = (m: Pick<Metric, "name" | "value">) => (m.name === "CLS" ? m.value.toFixed(4) : String(Math.round(m.value)));

/** The element behind a vital, as a CSS selector: the LCP's, the one that shifted most, the one interacted with. */
export function targetOf(m: Metric): string {
  const a = m.attribution as { target?: string; largestShiftTarget?: string; interactionTarget?: string } | undefined;
  const t = m.name === "LCP" ? a?.target : m.name === "CLS" ? a?.largestShiftTarget : m.name === "INP" ? a?.interactionTarget : undefined;
  return readable(t ?? "").slice(0, 255);
}

// A class a build tool generated: a hash of five or more letters and digits, at least one a digit, set off by _ or -
// (next/font's Wwg0mW_variable, CSS Modules' Card_root__a1B2c, styled-components' sc-x8f2kq).
const GENERATED = /(^|[_-])(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{5,}($|[_-])/;

/**
 * web-vitals' selector as a person reads it: without <html>, which only carries the fonts' and theme's classes, and
 * without generated class names, which change with every build.
 */
export function readable(selector: string) {
  return selector
    .split(">")
    .filter((part, i) => !(i === 0 && /^html\b/.test(part)))
    .map((part) => {
      const [element = "", ...classes] = part.split(".");
      return [element, ...classes.filter((c) => !GENERATED.test(c))].join(".");
    })
    .join(">");
}

const connection = () => (navigator as { connection?: { effectiveType?: string } }).connection?.effectiveType ?? "";

/**
 * Measures this page load's Core Web Vitals and sends them together, against the path it loaded on: when the page is
 * hidden (CLS and INP are only final then), or once all five are in. A later vital, after the page came back from the
 * back-forward cache, starts another batch.
 */
export function start(script: HTMLScriptElement | null, observe = { onLCP, onINP, onCLS, onFCP, onTTFB }) {
  const ds = script?.dataset ?? {};
  const endpoint = ds.endpoint || ENDPOINT;
  const debug = ds.debug === "true";
  let beforeSend: SpeedBeforeSend | undefined;
  const run = (...[command, arg]: SpeedCommand) => {
    if (command === "beforeSend") beforeSend = arg;
    else if (command === "route") script?.setAttribute("data-route", arg ?? "");
  };
  for (const c of window.osiq ?? []) run(...c);
  window.osi = run;
  window.osiq = [];

  const rate = Number(ds.sampleRate ?? 1);
  if (automated() || !(Math.random() < (Number.isFinite(rate) ? rate : 1))) return;
  const url = location.href;
  let route: string | undefined;
  const pending: Metric[] = [];

  const flush = () => {
    if (!pending.length) return;
    const batch = pending.splice(0);
    const event = { type: "vital" as const, url, route };
    const out = beforeSend ? beforeSend(event) : event;
    if (!out) return;
    const fields: Record<string, string> = { e: "vitals", p: pathOf(out.url) };
    if (out.route) fields.o = out.route;
    const c = connection();
    if (c) fields.c = c;
    for (const m of batch) {
      fields[m.name] = valueOf(m);
      const t = targetOf(m);
      if (t) fields[`${m.name}_t`] = t;
    }
    send(endpoint, fields, debug);
  };
  const report = (m: Metric) => {
    // The route the framework gave for the page that loaded, read once its first vital is in.
    if (route === undefined) route = script?.dataset.route || "";
    pending.push(m);
    if (document.visibilityState === "hidden" || pending.length >= 5) flush();
  };
  observe.onLCP(report);
  observe.onINP(report);
  observe.onCLS(report);
  observe.onFCP(report);
  observe.onTTFB(report);
  // After web-vitals' own listeners, which report CLS, INP and LCP when the page is hidden.
  addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  addEventListener("pagehide", flush);
}
