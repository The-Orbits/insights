// How a flag's setting answers for a context, exactly as the API documents it (GET /v1/flags/definitions): the first
// matching rule's serve; else a boolean is off when switched off, else on for its rollout's share of ids; a string or
// number flag serves its value.

export type FlagValue = boolean | string | number;

/** What a rule can read: an id for rollouts, and anything else to target on (email, plan, user.country). */
export type FlagContext = { id?: string | number | null; [attribute: string]: unknown };

export type RuleOperator = "equals" | "not_equals" | "one_of" | "ends_with" | "starts_with" | "contains";

export interface Rule {
  attribute: string;
  operator: RuleOperator;
  values: string[];
  serve: FlagValue;
}

export interface Definition {
  type: "boolean" | "string" | "number";
  on: boolean;
  rollout: number;
  value: string | number | null;
  rules: Rule[];
}

/** The context's value at a name, or a dotted path into it (user.country). */
function read(context: FlagContext, attribute: string): unknown {
  let at: unknown = context;
  for (const part of attribute.split(".")) {
    if (at === null || typeof at !== "object") return undefined;
    at = (at as Record<string, unknown>)[part];
  }
  return at;
}

/** Comparisons ignore case: an email's domain is the same whatever the visitor typed. */
export function matches(rule: Rule, context: FlagContext) {
  const raw = read(context, rule.attribute);
  if (raw === undefined || raw === null || typeof raw === "object") return false;
  const value = String(raw).toLowerCase();
  const values = rule.values.map((v) => v.toLowerCase());
  const first = values[0] ?? "";
  switch (rule.operator) {
    case "equals":
      return value === first;
    case "not_equals":
      return value !== first;
    case "one_of":
      return values.includes(value);
    case "ends_with":
      return value.endsWith(first);
    case "starts_with":
      return value.startsWith(first);
    case "contains":
      return value.includes(first);
  }
}

/** 0–99, the same for a flag and an id every time (32-bit FNV-1a), so a visitor stays in or out as a rollout grows. */
export function bucket(key: string, id: string) {
  let hash = 0x811c9dc5;
  for (const ch of `${key}:${id}`) {
    hash ^= ch.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 100;
}

export function evaluate(key: string, def: Definition, context: FlagContext = {}): FlagValue {
  for (const rule of def.rules) if (matches(rule, context)) return rule.serve;
  if (def.type !== "boolean") return def.value ?? (def.type === "number" ? 0 : "");
  if (!def.on) return false;
  if (def.rollout >= 100) return true;
  const id = context.id;
  // Without an id there's no stable share to be in.
  if (id === undefined || id === null || id === "") return false;
  return bucket(key, String(id)) < def.rollout;
}
