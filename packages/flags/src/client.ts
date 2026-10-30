import { type Definition, evaluate, type FlagContext, type FlagValue } from "./evaluate";

export interface FlagsOptions {
  /** The environment's key: ORBITS_FLAGS, which Orbits sets on every deployment. */
  key?: string;
  /** Orbits' API: ORBITS_API_URL, set beside it. */
  apiUrl?: string;
  /** How old the flags may get before they're fetched again in the background, in ms (5 seconds). */
  refreshMs?: number;
  /** Report which flags were checked, for the flag's "Seen in the last 24 hours" (on unless false). */
  report?: boolean;
  /** Log fetches and reports. */
  debug?: boolean;
  fetch?: typeof fetch;
}

type Definitions = { environment: string; version: string; flags: Record<string, Definition> };

const DEFAULT_API = "https://api.theorbits.app";
const REPORT_EVERY = 60_000;
const IDS_PER_FLAG = 500;
const TIMEOUT = 3_000;

declare const process: { env: Record<string, string | undefined> } | undefined;
const env = (name: string) => (typeof process === "undefined" ? undefined : process.env[name]);

/** The first 16 hex characters of an id's SHA-256: what's reported, never the id itself. */
async function hashId(id: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
  return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class FlagsClient {
  private readonly key: string | undefined;
  private readonly api: string;
  private readonly refreshMs: number;
  private readonly report: boolean;
  private readonly debug: boolean;
  private readonly fetch: typeof fetch;
  private current: Definitions | null = null;
  private fetchedAt = 0;
  private loading: Promise<void> | null = null;
  private warned = false;
  private readonly checks = new Map<string, { count: number; ids: Set<string> }>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: FlagsOptions = {}) {
    this.key = options.key ?? env("ORBITS_FLAGS");
    this.api = (options.apiUrl ?? env("ORBITS_API_URL") ?? DEFAULT_API).replace(/\/+$/, "");
    this.refreshMs = options.refreshMs ?? 5_000;
    this.report = options.report ?? true;
    this.debug = options.debug ?? false;
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private log(...args: unknown[]) {
    if (this.debug) console.info("[Orbits Flags]", ...args);
  }

  /** Fetches the flags, or confirms the ones held are current; keeps them when Orbits can't be reached. */
  private load() {
    this.loading ??= (async () => {
      try {
        const res = await this.fetch(`${this.api}/v1/flags/definitions`, {
          headers: { authorization: `Bearer ${this.key}`, ...(this.current ? { "if-none-match": `"${this.current.version}"` } : {}) },
          cache: "no-store",
          signal: AbortSignal.timeout(TIMEOUT),
        });
        if (res.status === 304) this.log("unchanged");
        else if (res.ok) {
          this.current = (await res.json()) as Definitions;
          this.log(`fetched ${Object.keys(this.current.flags).length} flags for ${this.current.environment}`);
        } else if (!this.warned) {
          this.warned = true;
          console.warn(`[Orbits Flags] Orbits answered ${res.status} for the flags; checks get their defaults until it doesn't.`);
        }
        this.fetchedAt = Date.now();
      } catch (error) {
        this.log("couldn't reach Orbits", error);
        this.fetchedAt = Date.now();
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }

  /** The environment's flags: fetched the first time, then served from memory and refreshed behind the scenes. */
  async definitions(): Promise<Definitions | null> {
    if (!this.key) {
      if (!this.warned) {
        this.warned = true;
        console.warn("[Orbits Flags] ORBITS_FLAGS isn't set, so every flag gets its default. Orbits sets it on deployments; locally, copy Development's key from the Flags page into .env.local.");
      }
      return null;
    }
    if (!this.current) await this.load();
    else if (Date.now() - this.fetchedAt >= this.refreshMs) void this.load();
    return this.current;
  }

  /** A flag's value for this context, or the default when Orbits has no such flag (or couldn't be reached). */
  async flag<T extends FlagValue = boolean>(key: string, context: FlagContext = {}, defaultValue?: T): Promise<T> {
    const fallback = (defaultValue ?? false) as T;
    const defs = await this.definitions();
    const def = defs?.flags[key];
    if (!def) return fallback;
    this.count(key, context.id);
    return evaluate(key, def, context) as T;
  }

  /** Every flag's value for this context, such as to hand a page all it needs at once. */
  async all(context: FlagContext = {}): Promise<Record<string, FlagValue>> {
    const defs = await this.definitions();
    if (!defs) return {};
    return Object.fromEntries(Object.entries(defs.flags).map(([key, def]) => [key, evaluate(key, def, context)]));
  }

  private count(key: string, id: FlagContext["id"]) {
    if (!this.report) return;
    const c = this.checks.get(key) ?? { count: 0, ids: new Set<string>() };
    c.count++;
    if (id !== undefined && id !== null && id !== "" && c.ids.size < IDS_PER_FLAG) c.ids.add(String(id));
    this.checks.set(key, c);
    if (!this.timer) {
      this.timer = setInterval(() => void this.flush(), REPORT_EVERY);
      // Reporting shouldn't keep a process alive that's otherwise done.
      (this.timer as { unref?: () => void }).unref?.();
    }
  }

  /** Sends what was checked since the last report. Called every minute while flags are checked. */
  async flush() {
    if (!this.key || !this.checks.size) return;
    const batch = [...this.checks].slice(0, 200);
    for (const [key] of batch) this.checks.delete(key);
    const flags = await Promise.all(batch.map(async ([key, c]) => ({ key, checks: c.count, ids: await Promise.all([...c.ids].map(hashId)) })));
    try {
      await this.fetch(`${this.api}/v1/flags/exposures`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.key}`, "content-type": "application/json" },
        body: JSON.stringify({ flags }),
        signal: AbortSignal.timeout(TIMEOUT),
      });
      this.log(`reported ${flags.length} flags`);
    } catch (error) {
      this.log("couldn't report checks", error);
    }
  }
}
