import { describe, expect, it } from "bun:test";
import { FlagsClient } from "./client";
import { bucket, type Definition, evaluate, matches } from "./evaluate";

const boolean = (over: Partial<Definition> = {}): Definition => ({ type: "boolean", on: true, rollout: 100, value: null, rules: [], ...over });

describe("evaluate", () => {
  it("lets the first matching rule decide, then the switch, then the rollout", () => {
    const def = boolean({
      on: false,
      rules: [
        { attribute: "email", operator: "ends_with", values: ["@kudi.ng"], serve: true },
        { attribute: "plan", operator: "one_of", values: ["pro", "team"], serve: true },
      ],
    });
    expect(evaluate("new-checkout", def, { email: "Ada@KUDI.ng" })).toBe(true);
    expect(evaluate("new-checkout", def, { plan: "team" })).toBe(true);
    expect(evaluate("new-checkout", def, { email: "ada@gmail.com", plan: "free" })).toBe(false);
    expect(evaluate("new-checkout", boolean({ rules: [{ attribute: "id", operator: "equals", values: ["usr_1"], serve: false }] }), { id: "usr_1" })).toBe(false);
  });

  it("rolls out to a stable share of ids, and to nobody without one", () => {
    const def = boolean({ rollout: 30 });
    const ids = Array.from({ length: 2000 }, (_, i) => `usr_${i}`);
    const on = ids.filter((id) => evaluate("new-checkout", def, { id })).length;
    expect(on / ids.length).toBeGreaterThan(0.25);
    expect(on / ids.length).toBeLessThan(0.35);
    // The same id gets the same answer, and stays in as the rollout grows.
    const inAt30 = ids.filter((id) => evaluate("new-checkout", def, { id }));
    expect(inAt30.every((id) => evaluate("new-checkout", boolean({ rollout: 60 }), { id }))).toBe(true);
    expect(evaluate("new-checkout", def, {})).toBe(false);
    expect(bucket("a", "x")).toBe(bucket("a", "x"));
    expect(bucket("a", "x")).not.toBe(bucket("b", "x"));
  });

  it("serves a string or number flag's value unless a rule says otherwise", () => {
    const search: Definition = { type: "string", on: true, rollout: 100, value: "typesense", rules: [{ attribute: "user.country", operator: "equals", values: ["gh"], serve: "algolia" }] };
    expect(evaluate("search", search, {})).toBe("typesense");
    expect(evaluate("search", search, { user: { country: "GH" } })).toBe("algolia");
    expect(evaluate("page-size", { type: "number", on: true, rollout: 100, value: 20, rules: [] })).toBe(20);
  });

  it("reads each operator, and nothing it can't compare", () => {
    const rule = (operator: Parameters<typeof matches>[0]["operator"], values: string[]) => ({ attribute: "email", operator, values, serve: true });
    const ctx = { email: "ada@kudi.ng" };
    expect(matches(rule("equals", ["ADA@kudi.ng"]), ctx)).toBe(true);
    expect(matches(rule("not_equals", ["dayo@kudi.ng"]), ctx)).toBe(true);
    expect(matches(rule("starts_with", ["ada@"]), ctx)).toBe(true);
    expect(matches(rule("contains", ["@kudi"]), ctx)).toBe(true);
    expect(matches(rule("one_of", ["x@y.z", "ada@kudi.ng"]), ctx)).toBe(true);
    expect(matches(rule("equals", ["a"]), {})).toBe(false);
    expect(matches(rule("not_equals", ["a"]), {})).toBe(false); // missing isn't "not a"
    expect(matches(rule("equals", ["[object Object]"]), { email: {} })).toBe(false);
  });
});

/** Orbits' API as the SDK sees it: definitions with an ETag, and exposures. */
function fakeApi(flags: Record<string, Definition>) {
  let version = "v1";
  const calls: { url: string; headers: Record<string, string>; body?: unknown }[] = [];
  const fetch = (async (url: string, init: RequestInit = {}) => {
    const headers = init.headers as Record<string, string>;
    calls.push({ url, headers, body: init.body ? JSON.parse(String(init.body)) : undefined });
    if (headers.authorization !== "Bearer ofl_test.key") return new Response(null, { status: 401 });
    if (url.endsWith("/exposures")) return new Response(null, { status: 204 });
    if (headers["if-none-match"] === `"${version}"`) return new Response(null, { status: 304 });
    return Response.json({ environment: "preview", version, flags });
  }) as typeof globalThis.fetch;
  return { fetch, calls, change: (next: Record<string, Definition>) => (Object.assign(flags, next), (version = `${version}x`)) };
}

describe("the client", () => {
  it("fetches once, answers from memory, and picks up changes in the background", async () => {
    const api = fakeApi({ "new-checkout": boolean({ on: false }) });
    const client = new FlagsClient({ key: "ofl_test.key", apiUrl: "https://api.example/", refreshMs: 0, fetch: api.fetch, report: false });
    expect(await client.flag("new-checkout")).toBe(false);
    expect(api.calls[0]!.url).toBe("https://api.example/v1/flags/definitions");
    api.change({ "new-checkout": boolean({ on: true }) });
    expect(await client.flag("new-checkout")).toBe(false); // the held set answers while the new one loads
    // The new set lands in the background; give it the ticks it takes rather than assume one.
    for (let i = 0; i < 50 && !(await client.flag("new-checkout")); i++) await new Promise((r) => setTimeout(r, 1));
    expect(await client.flag("new-checkout")).toBe(true);
    expect(api.calls.some((c) => c.headers["if-none-match"] === '"v1"')).toBe(true);
    expect(await client.all()).toEqual({ "new-checkout": true });
  });

  it("gives the default for an unknown flag, without a key, or when Orbits refuses", async () => {
    const api = fakeApi({});
    const warn = console.warn;
    console.warn = () => {};
    try {
      expect(await new FlagsClient({ key: "ofl_test.key", fetch: api.fetch }).flag("missing", {}, "fallback")).toBe("fallback");
      expect(await new FlagsClient({ key: "", fetch: api.fetch }).flag("missing")).toBe(false);
      expect(await new FlagsClient({ key: "ofl_wrong.key", fetch: api.fetch }).flag("x", {}, true)).toBe(true);
      const down = new FlagsClient({ key: "ofl_test.key", fetch: (async () => { throw new Error("offline"); }) as unknown as typeof fetch });
      expect(await down.flag("x", {}, 7)).toBe(7);
    } finally {
      console.warn = warn;
    }
  });

  it("reports how often each flag was checked, and for whom, by hashed id only", async () => {
    const api = fakeApi({ "new-checkout": boolean() });
    const client = new FlagsClient({ key: "ofl_test.key", fetch: api.fetch });
    await client.flag("new-checkout", { id: "usr_1" });
    await client.flag("new-checkout", { id: "usr_1" });
    await client.flag("new-checkout", { id: "usr_2" });
    await client.flag("new-checkout");
    await client.flag("not-a-flag", { id: "usr_3" });
    await client.flush();
    const sent = api.calls.find((c) => c.url.endsWith("/exposures"))!.body as { flags: { key: string; checks: number; ids: string[] }[] };
    expect(sent.flags).toHaveLength(1);
    expect(sent.flags[0]).toMatchObject({ key: "new-checkout", checks: 4 });
    expect(sent.flags[0]!.ids).toHaveLength(2);
    expect(sent.flags[0]!.ids.every((id) => /^[0-9a-f]{16}$/.test(id))).toBe(true);
    expect(JSON.stringify(sent)).not.toContain("usr_");
    await client.flush(); // nothing new, nothing sent
    expect(api.calls.filter((c) => c.url.endsWith("/exposures"))).toHaveLength(1);
  });
});
