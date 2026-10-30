# `@useorbits/workflows`

Durable workflows for apps on [Orbits](https://orbits.africa): code that runs in steps, keeps going after a crash or a
deploy, retries what fails, and can sleep for days or wait for an event, without a queue or a server of your own to
run.

Orbits keeps each run and calls your app for one step at a time. Steps that already finished return their saved
results, so a run picks up where it left off. Each run shows on your project's **Workflows** tab, with every step's
time, result and error, plus **Run now**, **Retry** and **Cancel**.

## Install

```sh
npm install @useorbits/workflows
```

## Write a workflow

```ts
// workflows/sync-stock.ts
import { workflow } from "@useorbits/workflows";

export const syncStock = workflow(
  "sync-stock",
  { schedule: "*/15 * * * *", description: "Pulls the supplier feed into inventory" },
  async ({ input, step, sleep }) => {
    const rows = await step("fetch-supplier-feed", () => fetchFeed());
    const valid = await step("parse-csv", () => parse(rows));
    await step("update-inventory", () => updateStock(valid));
    if (valid.skipped.length) {
      await step("notify-slack", () => notify(valid.skipped));
    }
    await sleep("1 hour");
    await step("write-report", () => writeReport(valid));
  },
);
```

Each `step()` runs its function once. Its return value is saved, and the step returns that from then on. When a step
throws, Orbits retries it with backoff (after 10 seconds, a minute, then 5 minutes), up to `retries` times. After the
last attempt the run fails, and **Retry** on the run page starts it again from that step.

## Serve it

Orbits runs your workflows through one endpoint in your app. In Next.js:

```ts
// app/.well-known/orbits/workflows/route.ts
import { serve } from "@useorbits/workflows";
import { syncStock } from "@/workflows/sync-stock";
import { sendOrderEmails } from "@/workflows/send-order-emails";

export const { GET, POST } = serve([syncStock, sendOrderEmails]);
```

`serve()` returns standard `Request` → `Response` handlers. Mount them at `/.well-known/orbits/workflows` in any
framework that takes those, such as Elysia, Hono or SvelteKit:

```ts
const { GET, POST } = serve([syncStock]);
app.get("/.well-known/orbits/workflows", ({ request }) => GET(request));
app.post("/.well-known/orbits/workflows", ({ request }) => POST(request));
```

Only Orbits reaches this endpoint. Orbits' edge keeps the path off the internet, and every call carries your
deployment's `ORBITS_WORKFLOWS` key, which Orbits sets for you. When a production deployment goes live, Orbits reads
its list of workflows from here.

## Start a run

A workflow runs by one of three things:

| How | Set it with | Its `input` |
| --- | --- | --- |
| A schedule | `schedule: "0 2 * * *"`, a five-field cron in UTC | `{}` |
| An event | `event: "order.paid"`, then `trigger("order.paid", data)` from your code | `data` |
| By hand | **Run now** on the Workflows tab | What you type |

```ts
import { trigger } from "@useorbits/workflows";

await trigger("order.paid", { order: order.id, email: order.email });
```

## Sleep and wait

```ts
const sendOrderEmails = workflow("send-order-emails", { event: "order.paid" }, async ({ input, step, sleep, waitFor }) => {
  await step("send-receipt", () => sendReceipt(input.order));
  const shipped = await waitFor<{ tracking: string }>("order.shipped", { timeout: "3 days" });
  if (shipped) await step("send-tracking", () => sendTracking(input.order, shipped.tracking));
  await sleep("7 days");
  await step("ask-for-review", () => askForReview(input.order));
});
```

`sleep()` takes `"30s"`, `"15 minutes"`, `"2 hours"`, `"1 day"` or milliseconds. `waitFor(event)` resumes when
`trigger(event, data)` is sent, and returns `data`. If a `timeout` passes first, it returns `null`. Neither holds a
server: the run is simply called again when it's time.

## One rule: same steps, same order

A run resumes by running your function again from the top, with finished steps answering from their saved results.
So the code outside steps has to reach the same steps in the same order every time. Put anything that can change
inside a step, such as the clock, randomness, or reading from a database or API:

```ts
// Don't: a different answer on each replay
if (Math.random() < 0.5) await step("a", doA);

// Do: decided once, inside a step
const pick = await step("pick", () => Math.random() < 0.5);
if (pick) await step("a", doA);
```

If a run's steps come back in another order, say because the code changed under it, it fails with an error that says
so, instead of guessing.

## Options

| Option | | |
| --- | --- | --- |
| `description` | | A line on the Workflows tab. |
| `schedule` | | A five-field cron, in UTC. |
| `event` | | The event that starts it. Use either this or `schedule`, not both. |
| `retries` | `2` | Attempts after the first, for each step (up to 10). |

## Try it locally

`runLocally()` runs a workflow to the end in your process: steps run once each, sleeps are skipped, and `waitFor()`
gets the events you pass. It's handy in tests:

```ts
import { runLocally } from "@useorbits/workflows";

const result = await runLocally(sendOrderEmails, { order: "ord_1" }, { events: { "order.shipped": { tracking: "GIG-1" } } });
// { state: "succeeded", output: …, steps: [...] }
```

## Limits

- A step's result is 256 KB at most as JSON, and so is a run's input.
- A step has 5 minutes to finish.
- Workflows run on production deployments, and need an app with a server on Node: Next.js, Node or Elysia. Static
  sites can't run them.

## License

MIT
