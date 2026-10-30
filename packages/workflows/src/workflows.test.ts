import { describe, expect, it } from "bun:test";
import { durationMs, execute, type Result } from "./engine";
import { runLocally, serve, trigger, workflow } from "./index";

/** A workflow that counts how often each step's own code ran, so a test can see replays don't run it again. */
function syncStock() {
  const ran: string[] = [];
  const w = workflow("sync-stock", { schedule: "*/15 * * * *", description: "Pulls the feed" }, async ({ input, step, sleep, waitFor }) => {
    const rows = await step("fetch-feed", () => (ran.push("fetch-feed"), [1, 2, 3]));
    const valid = await step("parse", () => (ran.push("parse"), rows.filter((r) => r > (input as { min: number }).min)));
    await sleep("1 hour");
    const approval = await waitFor<{ ok: boolean }>("stock.approved", { timeout: "2 days" });
    return { updated: valid.length, approved: approval?.ok ?? false };
  });
  return { w, ran };
}

const call = (steps: { name: string; kind: "step" | "sleep" | "wait"; output: string | null }[]) => ({ input: { min: 1 }, run: { id: "run_1", attempt: 1 }, steps });
const now = () => Date.parse("2026-10-30T10:00:00Z");

describe("a call", () => {
  it("runs the first new step and stops there, replaying the ones before it without running them", async () => {
    const { w, ran } = syncStock();
    expect(await execute(w.handler, call([]), now)).toEqual({ type: "step", name: "fetch-feed", output: "[1,2,3]", detail: "Returned 3 items", ms: 0 });
    expect(await execute(w.handler, call([{ name: "fetch-feed", kind: "step", output: "[1,2,3]" }]), now))
      .toMatchObject({ type: "step", name: "parse", output: "[2,3]" });
    expect(ran).toEqual(["fetch-feed", "parse"]); // fetch-feed ran once, though the second call replayed it
  });

  it("sleeps and waits by saying until when, and finishes with what the workflow returned", async () => {
    const { w } = syncStock();
    const done = [{ name: "fetch-feed", kind: "step" as const, output: "[1,2,3]" }, { name: "parse", kind: "step" as const, output: "[2,3]" }];
    expect(await execute(w.handler, call(done), now)).toEqual({ type: "sleep", name: "sleep 1 hour", until: "2026-10-30T11:00:00.000Z" });
    const slept = [...done, { name: "sleep 1 hour", kind: "sleep" as const, output: null }];
    expect(await execute(w.handler, call(slept), now)).toEqual({ type: "wait", name: "wait for stock.approved", event: "stock.approved", timeout: "2026-11-01T10:00:00.000Z" });
    expect(await execute(w.handler, call([...slept, { name: "wait for stock.approved", kind: "wait", output: '{"ok":true}' }]), now))
      .toEqual({ type: "done", output: '{"updated":2,"approved":true}' });
    // A wait that timed out gets null.
    expect(await execute(w.handler, call([...slept, { name: "wait for stock.approved", kind: "wait", output: null }]), now))
      .toEqual({ type: "done", output: '{"updated":2,"approved":false}' });
  });

  it("reports a step that threw, with where, and a workflow that threw outside a step", async () => {
    const failing = workflow("charge", {}, async ({ step }) => {
      await step("charge-card", () => {
        throw new TypeError("card declined");
      });
    });
    const result = (await execute(failing.handler, call([]), now)) as Extract<Result, { type: "step_failed" }>;
    expect(result).toMatchObject({ type: "step_failed", name: "charge-card" });
    expect(result.error[0]).toBe("TypeError: card declined");
    expect(result.error[1]).toMatch(/^ {2}at /);
    const broken = workflow("broken", {}, async () => {
      throw new Error("no config");
    });
    const outside = (await execute(broken.handler, call([]), now)) as Extract<Result, { type: "failed" }>;
    expect(outside.type).toBe("failed");
    expect(outside.error[0]).toBe("Error: no config");
  });

  it("refuses to go on when the code reaches its steps in another order", async () => {
    const { w } = syncStock();
    const result = await execute(w.handler, call([{ name: "something-else", kind: "step", output: "1" }]), now);
    expect(result).toMatchObject({ type: "failed" });
    expect((result as { error: string[] }).error[0]).toContain('Step 1 was step "something-else" when this run started, and is step "fetch-feed" now');
  });

  it("ends the call at the new step even when the workflow catches everything", async () => {
    const ran: string[] = [];
    const greedy = workflow("greedy", {}, async ({ step }) => {
      try {
        await step("one", () => ran.push("one"));
      } catch {
        // swallowed
      }
      await step("two", () => ran.push("two"));
      return "should not get here";
    });
    expect(await execute(greedy.handler, call([]), now)).toMatchObject({ type: "step", name: "one" });
    expect(ran).toEqual(["one"]);
  });

  it("fails a run whose step name Orbits couldn't keep, and fits its own names", async () => {
    const named = (name: string) => workflow("named", {}, async ({ step }) => step(name, () => 1));
    for (const bad of ["", " padded", "x".repeat(65), "line\nbreak"]) {
      const result = (await execute(named(bad).handler, call([]), now)) as Extract<Result, { type: "failed" }>;
      expect(result.type).toBe("failed");
      expect(result.error[0]).toContain("A step's name is up to 64 characters");
    }
    expect(await execute(named("Charge card: ₦8,500").handler, call([]), now)).toMatchObject({ type: "step", name: "Charge card: ₦8,500" });
    const long = workflow("long", {}, async ({ waitFor }) => waitFor(`order.${"x".repeat(80)}`));
    expect(((await execute(long.handler, call([]), now)) as { name: string }).name).toHaveLength(64);
  });
});

describe("the endpoint", () => {
  const { w } = syncStock();
  const emails = workflow("send-order-emails", { event: "order.paid", retries: 5 }, async ({ input }) => input);
  const { GET, POST } = serve([w, emails], { key: "owf_key.sig" });
  const req = (method: string, body?: unknown, key = "owf_key.sig") =>
    new Request("http://127.0.0.1:3000/.well-known/orbits/workflows", { method, headers: { "x-orbits-workflows-key": key, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

  it("lists the workflows, and only for the deployment's key", async () => {
    expect((await GET(req("GET", undefined, "owf_wrong.key"))).status).toBe(401);
    expect(await (await GET(req("GET"))).json()).toEqual({
      workflows: [
        { name: "sync-stock", description: "Pulls the feed", schedule: "*/15 * * * *" },
        { name: "send-order-emails", description: "", event: "order.paid", retries: 5 },
      ],
    });
  });

  it("runs the named workflow's next step", async () => {
    const res = await POST(req("POST", { run: { id: "run_1", workflow: "send-order-emails", input: { order: "ord_1" }, attempt: 1 }, steps: [] }));
    expect(await res.json()).toEqual({ type: "done", output: '{"order":"ord_1"}' });
    expect(await (await POST(req("POST", { run: { id: "run_2", workflow: "gone", input: {}, attempt: 1 }, steps: [] }))).json())
      .toEqual({ type: "failed", error: ['This deployment has no workflow named "gone".'] });
    expect((await POST(req("POST", { run: {} }, ""))).status).toBe(401);
  });

  it("can't be served without a key", async () => {
    const open = serve([w], { key: "" });
    expect((await open.GET(req("GET", undefined, ""))).status).toBe(401);
  });
});

describe("runLocally", () => {
  it("runs a workflow to the end, skipping sleeps and answering waits from the events given", async () => {
    const { w, ran } = syncStock();
    const out = await runLocally(w, { min: 1 }, { events: { "stock.approved": { ok: true } } });
    expect(out).toMatchObject({ state: "succeeded", output: { updated: 2, approved: true } });
    expect(out.steps.map((s) => s.name)).toEqual(["fetch-feed", "parse", "sleep 1 hour", "wait for stock.approved"]);
    expect(ran).toEqual(["fetch-feed", "parse"]);
  });
});

describe("helpers", () => {
  it("read durations", () => {
    expect(durationMs("30s")).toBe(30_000);
    expect(durationMs("15 minutes")).toBe(900_000);
    expect(durationMs("2 hours")).toBe(7_200_000);
    expect(durationMs("1 day")).toBe(86_400_000);
    expect(durationMs(500)).toBe(500);
    expect(() => durationMs("soon")).toThrow();
  });

  it("refuse names and options that can't work", () => {
    expect(() => workflow("Sync Stock", {}, async () => {})).toThrow();
    expect(() => workflow("both", { schedule: "* * * * *", event: "x" }, async () => {})).toThrow();
    const w = workflow("a", {}, async () => {});
    expect(() => serve([w, w])).toThrow();
  });

  it("send an event with the deployment's key", async () => {
    const sent: { url: string; init: RequestInit }[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => (sent.push({ url, init }), Response.json({ started: 1, resumed: 0 }))) as unknown as typeof fetch;
    try {
      expect(await trigger("order.paid", { order: "ord_1" }, { key: "owf_key.sig", apiUrl: "https://api.example/" })).toEqual({ started: 1, resumed: 0 });
      expect(sent[0]!.url).toBe("https://api.example/v1/workflows/events");
      expect((sent[0]!.init.headers as Record<string, string>).authorization).toBe("Bearer owf_key.sig");
      expect(JSON.parse(String(sent[0]!.init.body))).toEqual({ name: "order.paid", data: { order: "ord_1" } });
    } finally {
      globalThis.fetch = real;
    }
  });
});
