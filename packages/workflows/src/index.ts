import { type DoneStep, execute, type Handler, type Json, type Result } from "./engine";

export { type Context, type DoneStep, type Handler, type Json, type Result, durationMs, execute } from "./engine";

declare const process: { env: Record<string, string | undefined> } | undefined;
const env = (name: string) => (typeof process === "undefined" ? undefined : process.env[name]);

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_API = "https://api.theorbits.app";

export interface WorkflowOptions {
  /** A line on the Workflows page. */
  description?: string;
  /** When it runs on its own: a five-field cron, in UTC ("*\/15 * * * *" is every 15 minutes). */
  schedule?: string;
  /** Or the event that starts it: trigger("order.paid", data) runs it with data as its input. */
  event?: string;
  /** Attempts after the first, for each step (2). */
  retries?: number;
}

export interface Workflow<I = Json> {
  name: string;
  options: WorkflowOptions;
  handler: Handler<I>;
}

/**
 * Defines a workflow. Its function is replayed on every step: steps that finished return their saved results, so it
 * resumes where it left off after a failure, a deploy or a sleep.
 *
 *     export const syncStock = workflow("sync-stock", { schedule: "*\/15 * * * *" }, async ({ step }) => {
 *       const rows = await step("fetch-feed", () => fetchFeed());
 *       await step("update-inventory", () => updateStock(rows));
 *     });
 */
export function workflow<I = Json>(name: string, options: WorkflowOptions, handler: Handler<I>): Workflow<I> {
  if (!NAME.test(name)) throw new Error(`Workflow names are lowercase words joined by dashes, like "sync-stock", not "${name}"`);
  if (options.schedule && options.event) throw new Error(`${name}: give it a schedule or an event, not both`);
  return { name, options, handler };
}

/** The same strings, in time that doesn't depend on where they differ. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The endpoint Orbits calls to run your workflows, at /.well-known/orbits/workflows. In Next.js:
 *
 *     // app/.well-known/orbits/workflows/route.ts
 *     export const { GET, POST } = serve([syncStock, sendOrderEmails]);
 *
 * Only Orbits' builder reaches it: the edge keeps the path off the internet, and each call carries the deployment's
 * ORBITS_WORKFLOWS key.
 */
export function serve(workflows: Workflow<any>[], options: { key?: string } = {}) {
  const byName = new Map<string, Workflow<any>>();
  for (const w of workflows) {
    if (byName.has(w.name)) throw new Error(`Two workflows are named "${w.name}"`);
    byName.set(w.name, w);
  }
  const allowed = (req: Request) => {
    const key = options.key ?? env("ORBITS_WORKFLOWS");
    const sent = req.headers.get("x-orbits-workflows-key") ?? "";
    return !!key && same(sent, key);
  };
  const refuse = () => Response.json({ error: "This is Orbits' workflow endpoint." }, { status: 401 });

  async function GET(req: Request): Promise<Response> {
    if (!allowed(req)) return refuse();
    return Response.json({
      workflows: [...byName.values()].map((w) => ({
        name: w.name, description: w.options.description ?? "", schedule: w.options.schedule, event: w.options.event, retries: w.options.retries,
      })),
    });
  }

  async function POST(req: Request): Promise<Response> {
    if (!allowed(req)) return refuse();
    let call: { run: { id: string; workflow: string; input: unknown; attempt: number }; steps: DoneStep[] };
    try {
      call = (await req.json()) as typeof call;
    } catch {
      return Response.json({ error: "Send the run as JSON." }, { status: 400 });
    }
    const w = byName.get(call.run.workflow);
    const result: Result = w
      ? await execute(w.handler, { input: call.run.input ?? {}, run: { id: call.run.id, attempt: call.run.attempt }, steps: call.steps ?? [] })
      : { type: "failed", error: [`This deployment has no workflow named "${call.run.workflow}".`] };
    return Response.json(result);
  }

  return { GET, POST };
}

/**
 * Sends an event: starts the workflows that listen for it (with `data` as their input), and wakes runs waiting for it
 * in waitFor(). Events sent from a preview or your machine are accepted and do nothing: workflows run in production.
 */
export async function trigger(name: string, data: unknown = {}, options: { key?: string; apiUrl?: string } = {}): Promise<{ started: number; resumed: number }> {
  const key = options.key ?? env("ORBITS_WORKFLOWS");
  if (!key) {
    console.warn(`[Orbits Workflows] ORBITS_WORKFLOWS isn't set, so trigger("${name}") did nothing. Orbits sets it on deployments.`);
    return { started: 0, resumed: 0 };
  }
  const api = (options.apiUrl ?? env("ORBITS_API_URL") ?? DEFAULT_API).replace(/\/+$/, "");
  const res = await fetch(`${api}/v1/workflows/events`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ name, data }),
  });
  if (!res.ok) throw new Error(`[Orbits Workflows] Orbits answered ${res.status} to trigger("${name}"): ${await res.text()}`);
  return (await res.json()) as { started: number; resumed: number };
}

/**
 * Runs a workflow to the end in this process, for tests and trying one out: steps run once each, sleeps are skipped,
 * and waitFor() gets `events[name]` (null without one). A step that throws fails the run here; Orbits would retry it.
 */
export async function runLocally<I>(w: Workflow<I>, input: I, options: { events?: Record<string, unknown>; maxSteps?: number } = {}) {
  const steps: (DoneStep & { detail?: string })[] = [];
  for (let i = 0; i < (options.maxSteps ?? 1000); i++) {
    const result = await execute(w.handler, { input, run: { id: "run_local", attempt: 1 }, steps });
    switch (result.type) {
      case "step":
        steps.push({ name: result.name, kind: "step", output: result.output, detail: result.detail });
        break;
      case "sleep":
        steps.push({ name: result.name, kind: "sleep", output: null });
        break;
      case "wait": {
        const data = options.events?.[result.event];
        steps.push({ name: result.name, kind: "wait", output: data === undefined ? null : JSON.stringify(data) });
        break;
      }
      case "done":
        return { state: "succeeded" as const, output: JSON.parse(result.output) as unknown, steps };
      case "failed":
        return { state: "failed" as const, error: result.error, steps };
      case "step_failed":
        return { state: "failed" as const, error: result.error, failedStep: result.name, steps };
    }
  }
  throw new Error(`${w.name} took more than ${options.maxSteps ?? 1000} steps`);
}

