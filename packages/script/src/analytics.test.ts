import { describe, expect, it } from "bun:test";
import { cleanData, start } from "./analytics";
import { fakeBrowser } from "./test-browser";

describe("the analytics script", () => {
  it("counts the first page with where the visit came from, then each page the app moves to", () => {
    const b = fakeBrowser();
    start(b.script);
    b.go("/pricing");
    b.go("/pricing"); // the same page again isn't another view
    b.back("/");
    expect(b.sent).toEqual([
      { e: "pageview", p: "/", r: "https://www.google.com/" },
      { e: "pageview", p: "/pricing" },
      { e: "pageview", p: "/" },
    ]);
  });

  it("runs what the loader queued, beforeSend before the first page view", () => {
    const b = fakeBrowser({ path: "/admin/users" });
    window.oaq = [
      ["event", { name: "Signed up", data: { plan: "pro" } }],
      ["beforeSend", (e) => (e.type === "pageview" && e.url.includes("/admin") ? null : { ...e, url: e.url.replace(/\/orders\/\w+/, "/orders/[id]") })],
    ];
    start(b.script);
    b.go("/orders/ord_81");
    expect(b.sent).toEqual([
      { e: "event", p: "/admin/users", n: "Signed up", d: '{"plan":"pro"}' },
      { e: "pageview", p: "/orders/[id]" },
    ]);
  });

  it("leaves page views to the framework when it reports them, with their route", () => {
    const b = fakeBrowser({ path: "/blog/hello", dataset: { autoTrack: "false" } });
    window.oaq = [["pageview", { route: "/blog/[slug]", path: "/blog/hello" }]];
    start(b.script);
    b.go("/blog/second"); // the framework's own pushState isn't counted twice
    window.oa!("pageview", { route: "/blog/[slug]", path: "/blog/second" });
    window.oa!("event", { name: "Shared" });
    expect(b.sent).toEqual([
      { e: "pageview", p: "/blog/hello", o: "/blog/[slug]", r: "https://www.google.com/" },
      { e: "pageview", p: "/blog/second", o: "/blog/[slug]" },
      { e: "event", p: "/blog/second", o: "/blog/[slug]", n: "Shared" },
    ]);
  });

  it("keeps a custom event's properties flat and short", () => {
    const long = "x".repeat(300);
    expect(cleanData({ plan: "pro", seats: 3, trial: false, coupon: null, nested: { a: 1 }, list: [1], fn: () => 1, note: long }))
      .toEqual({ plan: "pro", seats: 3, trial: false, coupon: null, note: "x".repeat(255) });
    expect(cleanData({ [long]: 1 })).toBeUndefined();
    expect(Object.keys(cleanData(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i])))!)).toHaveLength(20);
  });

  it("sends nothing from a headless browser, though it still takes commands", () => {
    const b = fakeBrowser({ agent: "Mozilla/5.0 HeadlessChrome/131.0" });
    start(b.script);
    window.oa!("event", { name: "Clicked" });
    expect(b.sent).toEqual([]);
  });

  it("sends to the endpoint it was given", async () => {
    const urls: string[] = [];
    const b = fakeBrowser({ dataset: { endpoint: "/stats/e" } });
    globalThis.fetch = (async (url: string) => (urls.push(url), new Response(null))) as typeof fetch;
    start(b.script);
    expect(urls).toEqual(["/stats/e?e=pageview&r=https%3A%2F%2Fwww.google.com%2F&p=%2F"]);
  });
});
