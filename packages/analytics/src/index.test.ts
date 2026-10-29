import { afterEach, describe, expect, it } from "bun:test";
import { fakePage } from "../../../shared/test-page";
import { computeRoute, inject, pageview, track } from "./index";

let restore = () => {};
afterEach(() => restore());

describe("inject", () => {
  it("loads the edge's script once, and queues what's asked of it until it has loaded", () => {
    const page = fakePage();
    restore = page.restore;
    const beforeSend = () => null;
    inject({ mode: "production", beforeSend, debug: true });
    inject({ mode: "production" });
    track("Signed up", { plan: "pro" });
    expect(page.scripts).toEqual([{ src: "/_orbits/analytics.js", defer: true, dataset: { debug: "true" }, onerror: expect.any(Function) } as never]);
    expect(window.oaq).toEqual([["beforeSend", beforeSend], ["event", { name: "Signed up", data: { plan: "pro" } }]]);
  });

  it("leaves page views to the framework when it names the route", () => {
    const page = fakePage();
    restore = page.restore;
    inject({ mode: "production", route: "/blog/[slug]", endpoint: "/stats/e", scriptSrc: "/stats/a.js" });
    pageview({ route: "/blog/[slug]", path: "/blog/hello" });
    expect(page.scripts[0]).toMatchObject({ src: "/stats/a.js", dataset: { endpoint: "/stats/e", autoTrack: "false", route: "/blog/[slug]" } });
    expect(window.oaq).toEqual([["pageview", { route: "/blog/[slug]", path: "/blog/hello" }]]);
  });

  it("logs instead of loading anything on localhost", () => {
    const page = fakePage("localhost");
    restore = page.restore;
    inject();
    track("Clicked");
    expect(page.scripts).toEqual([]);
    expect(page.logs.map((l) => l[0])).toEqual([
      "[Orbits Analytics] Development: page views and events are logged here, not sent.",
      "[Orbits Analytics] event",
    ]);
  });
});

describe("computeRoute", () => {
  it("names each parameter, and a catch-all's segments", () => {
    expect(computeRoute("/blog/hello-world", { slug: "hello-world" })).toBe("/blog/[slug]");
    expect(computeRoute("/rsty/shop/settings", { team: "rsty", project: "shop" })).toBe("/[team]/[project]/settings");
    expect(computeRoute("/docs/a/b/c", { path: ["a", "b", "c"] })).toBe("/docs/[...path]");
    // A value only replaces a whole segment.
    expect(computeRoute("/shop/shopping", { id: "shop" })).toBe("/[id]/shopping");
    expect(computeRoute("/about", {})).toBe("/about");
    expect(computeRoute("/about", null)).toBe("/about");
  });
});
