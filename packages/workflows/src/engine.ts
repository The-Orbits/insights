// How a workflow runs: replayed from the start on every call, each step() that finished before returning its saved
// result, until it reaches a new one, which runs, and the call ends with its result. Orbits keeps the results and
// calls again, so a workflow survives crashes, deploys and days-long sleeps without holding a server.

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** A step that finished, as Orbits sends it back: its result as JSON text. */
export interface DoneStep {
  name: string;
  kind: "step" | "sleep" | "wait";
  output: string | null;
}

/** What one call did, in the shape Orbits' builder reports. */
export type Result =
  | { type: "step"; name: string; output: string; detail: string; ms: number }
  | { type: "step_failed"; name: string; error: string[]; ms: number }
  | { type: "sleep"; name: string; until: string }
  | { type: "wait"; name: string; event: string; timeout: string | null }
  | { type: "done"; output: string }
  | { type: "failed"; error: string[] };

export interface Context<I> {
  /** What the run started with: a schedule's is {}, an event's its data, Run now's what was typed. */
  input: I;
  run: { id: string; attempt: number };
  /**
   * Runs `fn` once, however often the workflow is replayed: its result is saved, and returned from then on. Retried
   * with backoff when it throws. Anything that reads the clock, randomness or the outside world belongs in one.
   */
  step<T>(name: string, fn: () => T | Promise<T>): Promise<T>;
  /** Pauses the run without holding a server: "30s", "15 minutes", "2 hours", "1 day", or milliseconds. */
  sleep(duration: string | number, name?: string): Promise<void>;
  /** Pauses until trigger(event) is sent, and returns its data; null when `timeout` passes first. */
  waitFor<T = Json>(event: string, options?: { timeout?: string | number; name?: string }): Promise<T | null>;
}

export type Handler<I> = (ctx: Context<I>) => unknown | Promise<unknown>;

const UNITS: Record<string, number> = {
  ms: 1, s: 1000, sec: 1000, second: 1000, m: 60_000, min: 60_000, minute: 60_000, h: 3_600_000, hr: 3_600_000, hour: 3_600_000, d: 86_400_000, day: 86_400_000,
  w: 604_800_000, week: 604_800_000,
};

/** "15 minutes", "2h", "1 day", or milliseconds, as milliseconds. */
export function durationMs(d: string | number): number {
  if (typeof d === "number" && Number.isFinite(d) && d >= 0) return d;
  const m = /^\s*(\d+(?:\.\d+)?)\s*([a-z]+?)s?\s*$/i.exec(String(d));
  const unit = m ? UNITS[m[2]!.toLowerCase()] : undefined;
  if (!m || !unit) throw new Error(`"${d}" isn't a duration: use something like "30s", "15 minutes", "2 hours" or "1 day"`);
  return Number(m[1]) * unit;
}

/** A step's result as the run page shows it in a line. */
export function describe(value: unknown): string {
  if (value === undefined || value === null) return "Done";
  if (Array.isArray(value)) return `Returned ${value.length.toLocaleString("en-GB")} ${value.length === 1 ? "item" : "items"}`;
  if (typeof value === "string") return `Returned "${value.length > 60 ? `${value.slice(0, 60)}…` : value}"`;
  if (typeof value === "object") return "Returned an object";
  return `Returned ${String(value)}`;
}

/** An error as the run page shows it: what happened, then where. */
export function errorLines(error: unknown): string[] {
  if (!(error instanceof Error)) return [String(error)];
  const frames = (error.stack ?? "").split("\n").slice(1).map((l) => l.trim()).filter((l) => l.startsWith("at ")).slice(0, 4);
  return [`${error.name}: ${error.message}`, ...frames.map((f) => `  ${f}`)];
}

/** Thrown to end a call once something new has happened; never seen by the workflow unless it catches everything. */
class Pause {
  constructor(readonly result: Result) {}
}

class NonDeterministic extends Error {
  name = "NonDeterministic";
}

/**
 * One call: replays `handler` against the steps already done and returns what happened next. `now` decides when a
 * sleep ends.
 */
export async function execute<I>(handler: Handler<I>, call: { input: I; run: { id: string; attempt: number }; steps: DoneStep[] }, now = () => Date.now()): Promise<Result> {
  let at = 0;
  let paused: Result | null = null;

  /** The next finished step, checked against what the code asks for now; undefined when the code has reached a new one. */
  const replay = (name: string, kind: DoneStep["kind"]): DoneStep | undefined => {
    // Once a call has something new, it's over: code that caught the pause and went on doesn't run anything else.
    if (paused) throw new Pause(paused);
    const done = call.steps[at];
    if (!done) return undefined;
    if (done.name !== name || done.kind !== kind) {
      throw new NonDeterministic(
        `Step ${at + 1} was ${done.kind} "${done.name}" when this run started, and is ${kind} "${name}" now. Workflows replay their code on every step, so it has to reach its steps in the same order each time: keep anything that varies (the clock, randomness, reads) inside a step.`,
      );
    }
    at += 1;
    return done;
  };
  const pause = (result: Result): never => {
    paused = result;
    throw new Pause(result);
  };
  const parse = (text: string | null) => (text === null ? null : JSON.parse(text));

  const ctx: Context<I> = {
    input: call.input,
    run: call.run,
    async step<T>(name: string, fn: () => T | Promise<T>): Promise<T> {
      const done = replay(name, "step");
      if (done) return parse(done.output) as T;
      const started = now();
      let value: T;
      try {
        value = await fn();
      } catch (error) {
        return pause({ type: "step_failed", name, error: errorLines(error), ms: now() - started });
      }
      return pause({ type: "step", name, output: JSON.stringify(value ?? null), detail: describe(value), ms: now() - started });
    },
    async sleep(duration: string | number, name?: string) {
      const label = name ?? `sleep ${duration}`;
      if (replay(label, "sleep")) return;
      pause({ type: "sleep", name: label, until: new Date(now() + durationMs(duration)).toISOString() });
    },
    async waitFor<T>(event: string, options: { timeout?: string | number; name?: string } = {}) {
      const label = options.name ?? `wait for ${event}`;
      const done = replay(label, "wait");
      if (done) return parse(done.output) as T | null;
      return pause({
        type: "wait", name: label, event,
        timeout: options.timeout === undefined ? null : new Date(now() + durationMs(options.timeout)).toISOString(),
      });
    },
  };

  try {
    const output = await handler(ctx);
    if (paused) return paused;
    return { type: "done", output: JSON.stringify(output ?? null) };
  } catch (error) {
    if (error instanceof Pause) return error.result;
    if (paused) return paused;
    return { type: "failed", error: errorLines(error) };
  }
}
