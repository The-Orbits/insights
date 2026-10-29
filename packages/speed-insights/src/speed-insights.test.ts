import { afterEach, describe, expect, it, mock } from "bun:test";

type Report = (m: { name: string; value: number }) => void;
const reporters: Record<string, Report> = {};
// web-vitals needs a real browser; these stand in and let the test settle each vital.
mock.module("web-vitals", () => Object.fromEntries(["onLCP", "onINP", "onCLS", "onFCP", "onTTFB"].map((f) => [f, (r: Report) => (reporters[f.slice(2)] = r)])));

const { injectSpeedInsights, reset, valueOf } = await import("./index");

function browser(hostname = "shop.kudi.ng") {
  const sent: Record<string, string>[] = [];
  Object.assign(globalThis, {
    window: {},
    location: { hostname, protocol: "https:", pathname: "/checkout" },
    fetch: async (url: string) => {
      sent.push(Object.fromEntries(new URLSearchParams(url.split("?")[1])));
      return new Response(null);
    },
  });
  return sent;
}

describe("speed insights", () => {
  afterEach(() => {
    reset();
    for (const k of Object.keys(reporters)) delete reporters[k];
  });

  it("sends each vital as the browser settles it, against the path the page loaded on", () => {
    const sent = browser();
    injectSpeedInsights();
    expect(Object.keys(reporters).sort()).toEqual(["CLS", "FCP", "INP", "LCP", "TTFB"]);
    (globalThis.location as { pathname: string }).pathname = "/somewhere-else";
    reporters.LCP!({ name: "LCP", value: 2140.6 });
    reporters.CLS!({ name: "CLS", value: 0.031249 });
    expect(sent).toEqual([
      { e: "vital", n: "LCP", v: "2141", p: "/checkout" },
      { e: "vital", n: "CLS", v: "0.0312", p: "/checkout" },
    ]);
  });

  it("rounds timings to the millisecond and CLS to four places", () => {
    expect(valueOf({ name: "INP", value: 199.5 })).toBe("200");
    expect(valueOf({ name: "CLS", value: 0.1 })).toBe("0.1000");
  });

  it("measures nothing on localhost, or when sampled out", () => {
    browser("localhost");
    injectSpeedInsights();
    expect(Object.keys(reporters)).toHaveLength(0);
    reset();
    browser();
    injectSpeedInsights({ sampleRate: 0 });
    expect(Object.keys(reporters)).toHaveLength(0);
  });
});
