import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { beaconUrl, shouldSend } from "./beacon";
import { inject, pageview, reset } from "./index";

type Fake = { sent: URLSearchParams[]; go: (path: string) => void; back: (path: string) => void };

/** A browser just enough for inject(): a location, a history that moves it, a referrer and fetch. */
function browser(hostname = "shop.kudi.ng", referrer = "https://www.google.com/"): Fake {
  const sent: URLSearchParams[] = [];
  const location = { hostname, protocol: "https:", pathname: "/" };
  const listeners: (() => void)[] = [];
  const history = {
    pushState(_state: unknown, _title: string, url?: string) {
      if (url) location.pathname = url;
    },
  };
  Object.assign(globalThis, {
    window: { addEventListener: (_: string, f: () => void) => listeners.push(f) },
    location,
    history,
    document: { referrer },
    fetch: async (url: string) => {
      sent.push(new URLSearchParams(url.split("?")[1]));
      return new Response(null, { status: 200 });
    },
  });
  return {
    sent,
    go: (path) => history.pushState(null, "", path),
    back: (path) => {
      location.pathname = path;
      for (const f of listeners) f();
    },
  };
}

describe("the beacon", () => {
  it("is sent from real sites, not local ones unless debugging", () => {
    expect(shouldSend({ hostname: "shop.kudi.ng", protocol: "https:" })).toBe(true);
    for (const hostname of ["localhost", "127.0.0.1", "[::1]", "my-mac.local"]) expect(shouldSend({ hostname, protocol: "http:" })).toBe(false);
    expect(shouldSend({ hostname: "localhost", protocol: "http:" }, true)).toBe(true);
    expect(shouldSend({ hostname: "shop.kudi.ng", protocol: "file:" })).toBe(false);
  });

  it("carries its fields in the query string of the edge's path", () => {
    expect(beaconUrl({ e: "pageview", p: "/a b", r: "https://x.com/?q=1&z" })).toBe("/_orbits/e?e=pageview&p=%2Fa+b&r=https%3A%2F%2Fx.com%2F%3Fq%3D1%26z");
  });
});

describe("inject", () => {
  beforeEach(() => reset());
  afterEach(() => reset());

  it("counts this page with where the visit came from, then each page the app moves to", async () => {
    const b = browser();
    inject();
    b.go("/pricing");
    b.go("/pricing"); // the same page again isn't another view
    b.back("/");
    await Promise.resolve();
    expect(b.sent.map((q) => Object.fromEntries(q))).toEqual([
      { e: "pageview", p: "/", r: "https://www.google.com/" },
      { e: "pageview", p: "/pricing" },
      { e: "pageview", p: "/" },
    ]);
  });

  it("starts once, however often it's called", async () => {
    const b = browser();
    inject();
    inject();
    expect(b.sent).toHaveLength(1);
  });

  it("sends nothing from localhost, and nothing before inject()", async () => {
    const b = browser("localhost");
    pageview("/");
    inject();
    b.go("/a");
    expect(b.sent).toHaveLength(0);
  });

  it("leaves the referrer out when there's none", async () => {
    const b = browser("shop.kudi.ng", "");
    inject();
    expect(Object.fromEntries(b.sent[0]!)).toEqual({ e: "pageview", p: "/" });
  });
});
