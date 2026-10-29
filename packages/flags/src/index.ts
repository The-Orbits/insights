import { FlagsClient, type FlagsOptions } from "./client";
import type { FlagContext, FlagValue } from "./evaluate";

export { FlagsClient, type FlagsOptions } from "./client";
export { bucket, evaluate, matches, type Definition, type FlagContext, type FlagValue, type Rule, type RuleOperator } from "./evaluate";

let shared: FlagsClient | null = null;
const client = () => (shared ??= new FlagsClient());

/**
 * A flag's value, in server code: on, off or its value in this deployment's environment, for this context. Rules
 * read the context (`email`, `plan`, `user.country`), rollouts its `id`. Without such a flag, or before Orbits can be
 * reached, it's the default: false unless you pass one.
 *
 *     if (await flag("new-checkout", { id: user.id, email: user.email })) return <OnePageCheckout />;
 *     const backend = await flag("search-backend", {}, "typesense");
 */
export function flag<T extends FlagValue = boolean>(key: string, context?: FlagContext, defaultValue?: T): Promise<T> {
  return client().flag(key, context, defaultValue);
}

/** Every flag's value for this context at once. */
export function flags(context?: FlagContext) {
  return client().all(context);
}

/** Sets how the shared client reads flags; call before the first flag(). Without it, it reads ORBITS_FLAGS. */
export function configure(options: FlagsOptions) {
  shared = new FlagsClient(options);
}
