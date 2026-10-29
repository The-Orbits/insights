# `@useorbits/analytics`

Privacy-friendly page views for apps on [Orbits](https://orbits.africa). No cookies, no IP addresses stored, and nothing
sent from `localhost`.

Each page a visitor sees, including a single-page app's own navigations, sends one small `GET /_orbits/e` request to your
site's own address, which Orbits' edge answers. A visitor is counted by a hash that changes every day, so nobody can be
followed from one day to the next. The numbers show up in your project's **Analytics** tab.

## Install

```sh
npm install @useorbits/analytics
```

Then open your project on Orbits, go to the **Analytics** tab and press **Turn on Analytics**.

## Next.js

Put `<Analytics />` in the root layout, once:

```tsx
// app/layout.tsx
import { Analytics } from "@useorbits/analytics/next";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

With the Pages Router, render it in `pages/_app.tsx` instead.

## React (Vite, React Router, TanStack Router, …)

```tsx
import { Analytics } from "@useorbits/analytics/react";

export function App() {
  return (
    <>
      <Routes />
      <Analytics />
    </>
  );
}
```

## Any other framework, or none

Call `inject()` once in code that runs in the browser:

```ts
import { inject } from "@useorbits/analytics";

inject();
```

- **Vue:** in `main.ts`, after `createApp(...)`.
- **SvelteKit:** in `onMount` in the root `+layout.svelte`.
- **Astro:** in a `<script>` in your base layout.
- **Plain HTML with a bundler:** in your entry file.

`inject()` does nothing on the server, so it's safe to call from code that runs in both places.

## Options

`<Analytics />` takes the same options as `inject()`:

| Option | Default | |
| --- | --- | --- |
| `debug` | `false` | Also send from `localhost`, and log each page view to the console. |
| `endpoint` | `"/_orbits/e"` | Where page views go. You won't normally change it. |

```tsx
<Analytics debug={process.env.NODE_ENV !== "production"} />
```

## What counts as a page view

- **The page the visitor lands on:** counted, with the referrer if there is one.
- **Each `history.pushState` and back or forward move:** counted, so client-side routing is covered.
- **The same path twice in a row:** counted once. Query strings and hashes are left out.

To count a page view yourself, for example a step in a wizard that keeps the same URL, call `pageview("/checkout/payment")`
after `inject()`.

## Off Orbits

On a host that isn't Orbits, `/_orbits/e` is a plain 404. Nothing breaks, and nothing is collected.

## Speed Insights

To also measure Core Web Vitals from real visits, add
[`@useorbits/speed-insights`](https://www.npmjs.com/package/@useorbits/speed-insights).

## License

MIT
