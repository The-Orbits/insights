# `@useorbits/analytics`

Privacy-friendly page views and custom events for apps on [Orbits](https://orbits.africa). No cookies, no IP
addresses stored, and nothing sent in development.

The package is a small loader. It adds Orbits' script, `/_orbits/analytics.js`, which your site's own address serves
once Analytics is on, and that script counts each page a visitor sees, single-page navigations included. A visitor is
counted by a hash that changes every day, so nobody can be followed from one day to the next. The numbers show up in
your project's **Analytics** tab.

## Install

```sh
npm install @useorbits/analytics
```

Then open your project on Orbits, go to the **Analytics** tab and press **Turn on Analytics**. The script is served,
and visits are counted, only for production deployments of projects that turned it on.

## Next.js

Put `<Analytics />` in the root layout, once. Pages are grouped by the route that served them (`/blog/[slug]`), not
each address:

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

## React (Vite, React Router, TanStack Router, Remix, …)

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

## Vue and Nuxt

```vue
<!-- App.vue, or app.vue in Nuxt -->
<script setup lang="ts">
import { Analytics } from "@useorbits/analytics/vue";
</script>

<template>
  <RouterView />
  <Analytics />
</template>
```

## SvelteKit

```ts
// src/routes/+layout.ts
import { injectAnalytics } from "@useorbits/analytics/sveltekit";

injectAnalytics();
```

Pages are grouped by SvelteKit's route (`/products/[id]`).

## Astro

```astro
---
// src/layouts/Base.astro
import Analytics from "@useorbits/analytics/astro";
---

<Analytics />
```

Astro 5 names the route that served each page; View Transitions are counted too.

## Any other framework, or plain HTML

With a bundler, call `inject()` once in code that runs in the browser:

```ts
import { inject } from "@useorbits/analytics";

inject();
```

Without one, add the script itself. It's the same script the package loads:

```html
<script defer src="/_orbits/analytics.js"></script>
```

## Custom events

Count what matters to you, such as sign-ups or orders, from anywhere in the browser:

```ts
import { track } from "@useorbits/analytics";

track("Signed up", { plan: "pro", seats: 3 });
```

Properties are flat: strings, numbers, booleans or `null`, up to 20 of them. Names, keys and strings are cut at 255
characters. The **Events** panel on the Analytics tab lists events by how often they were sent; pick one to see its
properties.

## Options

`<Analytics />` takes the same options as `inject()`:

| Option | Default | |
| --- | --- | --- |
| `beforeSend` | | A function that gets each page view and event before it's sent. Return it, changed or not, or `null` to drop it. |
| `mode` | `"auto"` | `"development"` logs to the console instead of sending; `"auto"` is development in a dev build or on `localhost`. |
| `debug` | `false` | Log each page view and event the script sends. |
| `scriptSrc` | `"/_orbits/analytics.js"` | Where the script is loaded from. |
| `endpoint` | `"/_orbits/e"` | Where page views and events go. |

`beforeSend` keeps private things out of your numbers:

```tsx
<Analytics
  beforeSend={(event) => {
    if (event.url.includes("/admin")) return null;
    return { ...event, url: event.url.replace(/\/invite\/[^/]+/, "/invite/[code]") };
  }}
/>
```

The Astro component can't take a function: set `window.orbitsAnalyticsBeforeSend` before it renders instead.

## What counts as a page view

- **The page the visitor lands on:** counted, with the referrer if there is one.
- **Each `history.pushState` and back or forward move:** counted, so client-side routing is covered. The Next.js,
  SvelteKit and Astro components report their own navigations instead, with the route.
- **The same path twice in a row:** counted once. Query strings and hashes are left out.
- **Browsers driven by a script, crawlers and link previews:** not counted.

To count a page view yourself, such as a step in a wizard that keeps the same URL, call
`pageview({ path: "/checkout/payment" })`.

## Speed Insights

To also measure Core Web Vitals from real visits, add
[`@useorbits/speed-insights`](https://www.npmjs.com/package/@useorbits/speed-insights).

## License

MIT
