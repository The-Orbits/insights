import { describe, expect, it } from "bun:test";
import { start, targetOf, valueOf } from "./speed-insights";
import { fakeBrowser } from "./test-browser";

type Metric = { name: string; value: number; attribution?: Record<string, unknown> };
type Report = (m: Metric) => void;

/** web-vitals needs a real browser: these stand in, and let a test settle each vital. */
function vitals() {
  const reporters: Record<string, Report> = {};
  const observe = Object.fromEntries(["LCP", "INP", "CLS", "FCP", "TTFB"].map((n) => [`on${n}`, (r: Report) => (reporters[n] = r)]));
  return { reporters, observe: observe as unknown as Parameters<typeof start>[1] };
}

describe("the speed insights script", () => {
  it("sends the five vitals together once they're all in, against the page that loaded, with what caused them", () => {
    const b = fakeBrowser({ path: "/checkout", dataset: { route: "/checkout" } });
    const { reporters, observe } = vitals();
    start(b.script, observe);
    b.go("/somewhere-else");
    reporters.TTFB!({ name: "TTFB", value: 410.4 });
    reporters.FCP!({ name: "FCP", value: 1200 });
    reporters.LCP!({ name: "LCP", value: 2140.6, attribution: { target: "main>img.hero" } });
    reporters.INP!({ name: "INP", value: 199.5, attribution: { interactionTarget: "button#pay" } });
    expect(b.sent).toEqual([]);
    reporters.CLS!({ name: "CLS", value: 0.031249, attribution: { largestShiftTarget: "div.banner" } });
    expect(b.sent).toEqual([{
      e: "vitals", p: "/checkout", o: "/checkout", c: "3g",
      TTFB: "410", FCP: "1200", LCP: "2141", LCP_t: "main>img.hero", INP: "200", INP_t: "button#pay", CLS: "0.0312", CLS_t: "div.banner",
    }]);
  });

  it("sends what it has when the page is hidden, and anything after at once", () => {
    const b = fakeBrowser({ path: "/" });
    const { reporters, observe } = vitals();
    start(b.script, observe);
    reporters.FCP!({ name: "FCP", value: 900 });
    reporters.LCP!({ name: "LCP", value: 1500 });
    b.hide();
    reporters.CLS!({ name: "CLS", value: 0 });
    expect(b.sent).toEqual([
      { e: "vitals", p: "/", c: "3g", FCP: "900", LCP: "1500" },
      { e: "vitals", p: "/", c: "3g", CLS: "0.0000" },
    ]);
  });

  it("takes the route the framework names later, and beforeSend's say", () => {
    const b = fakeBrowser({ path: "/products/8412" });
    window.osiq = [["route", "/products/[id]"], ["beforeSend", (e) => ({ ...e, url: "https://shop.kudi.ng/products/redacted" })]];
    const { reporters, observe } = vitals();
    start(b.script, observe);
    reporters.FCP!({ name: "FCP", value: 900 });
    b.hide();
    expect(b.sent).toEqual([{ e: "vitals", p: "/products/redacted", o: "/products/[id]", c: "3g", FCP: "900" }]);
  });

  it("measures nothing when sampled out or headless, and beforeSend can drop a report", () => {
    for (const setup of [{ dataset: { sampleRate: "0" } }, { agent: "HeadlessChrome" }]) {
      const b = fakeBrowser(setup);
      const { reporters, observe } = vitals();
      start(b.script, observe);
      expect(Object.keys(reporters)).toEqual([]);
    }
    const b = fakeBrowser();
    window.osiq = [["beforeSend", () => null]];
    const { reporters, observe } = vitals();
    start(b.script, observe);
    reporters.FCP!({ name: "FCP", value: 900 });
    b.hide();
    expect(b.sent).toEqual([]);
  });

  it("rounds timings to the millisecond and CLS to four places, and names only the vitals' own elements", () => {
    expect(valueOf({ name: "INP", value: 199.5 })).toBe("200");
    expect(valueOf({ name: "CLS", value: 0.1 })).toBe("0.1000");
    expect(targetOf({ name: "FCP", value: 1, attribution: { target: "x" } } as never)).toBe("");
    expect(targetOf({ name: "LCP", value: 1, attribution: { target: "y".repeat(300) } } as never)).toHaveLength(255);
  });
});
