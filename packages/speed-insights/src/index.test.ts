import { afterEach, describe, expect, it } from "bun:test";
import { fakePage } from "../../../shared/test-page";
import { injectSpeedInsights } from "./index";

let restore = () => {};
afterEach(() => restore());

describe("injectSpeedInsights", () => {
  it("loads the edge's script with its settings, and passes the route on when it's known", () => {
    const page = fakePage();
    restore = page.restore;
    const started = injectSpeedInsights({ mode: "production", sampleRate: 0.5, route: "/products/[id]" });
    started!.setRoute("/checkout");
    expect(page.scripts).toEqual([
      { src: "/_orbits/speed-insights.js", defer: true, dataset: { sampleRate: "0.5", route: "/products/[id]" }, onerror: expect.any(Function) } as never,
    ]);
    expect(window.osiq).toEqual([["route", "/checkout"]]);
  });

  it("measures nothing in development", () => {
    const page = fakePage("localhost");
    restore = page.restore;
    expect(injectSpeedInsights()).toBeNull();
    expect(page.scripts).toEqual([]);
  });
});
