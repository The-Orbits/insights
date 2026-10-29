# `@useorbits/flags`

Feature flags for apps on [Orbits](https://orbits.africa). Ship code switched off, then turn it on for your team, a
share of visitors, or everyone, from your project's **Flags** tab, without a redeploy.

Flags are checked in your app, not over the network. The SDK fetches your environment's flags once, answers every
check from memory, and refreshes them in the background every few seconds, so a change in the Flags tab reaches your
app within seconds.

## Install

```sh
npm install @useorbits/flags
```

Create a flag in your project's **Flags** tab. Orbits gives every deployment its environment's key as `ORBITS_FLAGS`,
so there's nothing to configure.

## Check a flag

In server code (a Server Component, a route handler, an API, a worker):

```tsx
import { flag } from "@useorbits/flags";

export default async function Checkout() {
  const user = await currentUser();
  if (await flag("new-checkout", { id: user.id, email: user.email })) {
    return <OnePageCheckout />;
  }
  return <ClassicCheckout />;
}
```

String and number flags return their value. Pass a default for when the flag doesn't exist yet, or Orbits can't be
reached:

```ts
const backend = await flag("search-backend", {}, "typesense");
const pageSize = await flag("page-size", {}, 20);
```

A boolean flag's default is `false`.

## Who gets what

What you pass as the second argument is the **context**. Rules in the Flags tab read it, and rollouts use its `id`.

| In the Flags tab | Reads |
| --- | --- |
| A rule, such as "Email ends with @kudi.ng" | The context's attribute: `email`, `plan`, `country`, or a path like `user.plan`. Comparisons ignore case. |
| Rollout to a share of visitors | `id`. The same id always gets the same answer, and stays in as the share grows. Without an id, only a 100% rollout is on. |

For each check, the first matching rule decides. Otherwise a boolean flag is off when it's switched off, and on for
its rollout's share of ids when it's on. A string or number flag serves its value.

To get every flag at once, such as to pass them all to a page:

```ts
import { flags } from "@useorbits/flags";

const all = await flags({ id: user.id });
// { "new-checkout": true, "search-backend": "typesense" }
```

## Environments

Each deployment reads its own environment: production deployments get Production's flags, previews get Preview's.

To use Development's flags on your machine, copy its key from the Flags tab into `.env.local`:

```sh
ORBITS_FLAGS=ofl_…
```

Without a key, every flag gets its default, and the SDK says so once in the console.

## Options

The shared client reads `ORBITS_FLAGS` and `ORBITS_API_URL`. To set them yourself, call `configure` before the first
check:

```ts
import { configure } from "@useorbits/flags";

configure({ key: process.env.MY_FLAGS_KEY, refreshMs: 10_000 });
```

| Option | Default | |
| --- | --- | --- |
| `key` | `ORBITS_FLAGS` | The environment's key. |
| `apiUrl` | `ORBITS_API_URL` | Orbits' API. |
| `refreshMs` | `5000` | How old the flags may get before they're fetched again in the background. |
| `report` | `true` | Report which flags were checked, for the Flags tab's "Seen in the last 24 hours". |
| `debug` | `false` | Log fetches and reports. |

For more than one key in a process, make a client of your own: `new FlagsClient({ key })`, then `client.flag(...)`.

## What's reported

About once a minute while flags are being checked, the SDK tells Orbits how often each flag was checked and for which
ids. Each id goes as the first 16 characters of its SHA-256, never as it was. Turn it off with
`configure({ report: false })`.

## License

MIT
