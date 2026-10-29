# `@useorbits/speed-insights`

Core Web Vitals from real visits to apps on [Orbits](https://orbits.africa): how fast your pages load and respond for
the people actually using them, on their own phones and networks, and which element on the page is behind each slow
one.

The package is a small loader. It adds Orbits' script, `/_orbits/speed-insights.js`, which your site's own address
serves once Speed Insights is on. The script measures LCP, INP, CLS, FCP and TTFB with Google's
[`web-vitals`](https://github.com/GoogleChrome/web-vitals) and sends them together when the visitor leaves the page.
No cookies, no IP addresses stored, nothing sent in development. Your project's **Speed Insights** tab shows the 75th
percentile of each metric, a score out of 100, your slowest routes and what's slowing them, for mobile and desktop.

## Install

```sh
npm install @useorbits/speed-insights
```

Then open your project on Orbits, go to the **Speed Insights** tab and press **Turn on Speed Insights**. The script is
served, and vitals are kept, only for production deployments of projects that turned it on.

## Next.js

Put `<SpeedInsights />` in the root layout, once. Each page load is reported against the route that served it
(`/blog/[slug]`):

```tsx
// app/layout.tsx
import { SpeedInsights } from "@useorbits/speed-insights/next";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
```

With the Pages Router, render it in `pages/_app.tsx` instead.

## React (Vite, React Router, TanStack Router, Remix, …)

```tsx
import { SpeedInsights } from "@useorbits/speed-insights/react";

export function App() {
  return (
    <>
      <Routes />
      <SpeedInsights />
    </>
  );
}
```

## Vue and Nuxt

```vue
<!-- App.vue, or app.vue in Nuxt -->
<script setup lang="ts">
import { SpeedInsights } from "@useorbits/speed-insights/vue";
</script>

<template>
  <RouterView />
  <SpeedInsights />
</template>
```

## SvelteKit

```ts
// src/routes/+layout.ts
import { injectSpeedInsights } from "@useorbits/speed-insights/sveltekit";

injectSpeedInsights();
```

## Astro

```astro
---
// src/layouts/Base.astro
import SpeedInsights from "@useorbits/speed-insights/astro";
---

<SpeedInsights />
```

## Any other framework, or plain HTML

With a bundler, call `injectSpeedInsights()` once in code that runs in the browser:

```ts
import { injectSpeedInsights } from "@useorbits/speed-insights";

injectSpeedInsights();
```

Without one, add the script itself. It's the same script the package loads:

```html
<script defer src="/_orbits/speed-insights.js"></script>
```

## Options

`<SpeedInsights />` takes the same options as `injectSpeedInsights()`:

| Option | Default | |
| --- | --- | --- |
| `sampleRate` | `1` | The share of page loads that report, from 0 to 1. Lower it on a busy site: `0.5` reports half. |
| `beforeSend` | | A function that gets each report before it's sent. Return it, changed or not, or `null` to drop it. |
| `mode` | `"auto"` | `"development"` measures nothing; `"auto"` is development in a dev build or on `localhost`. |
| `debug` | `false` | Log each report the script sends. |
| `scriptSrc` | `"/_orbits/speed-insights.js"` | Where the script is loaded from. |
| `endpoint` | `"/_orbits/e"` | Where reports go. |

```tsx
<SpeedInsights sampleRate={0.5} />
```

The Astro component can't take a function: set `window.orbitsSpeedInsightsBeforeSend` before it renders instead.

## What's measured

| Metric | What it tells you | Good | The element named |
| --- | --- | --- | --- |
| **LCP**, Largest Contentful Paint | When the main content appeared | 2.5 s or less | The largest element |
| **INP**, Interaction to Next Paint | How quickly the page responds to taps and clicks | 200 ms or less | The one interacted with |
| **CLS**, Cumulative Layout Shift | How much the layout jumps around while loading | 0.1 or less | The one that shifted most |
| **FCP**, First Contentful Paint | When anything first appeared | 1.8 s or less | |
| **TTFB**, Time to First Byte | How long the server took to start answering | 0.8 s or less | |

The score weighs FCP, LCP, INP and CLS the way Lighthouse does; TTFB is shown but not scored. Each report also says the
connection the visitor was on (4G, 3G, …), where the browser tells.

## Analytics

To also count visitors, page views and custom events, add
[`@useorbits/analytics`](https://www.npmjs.com/package/@useorbits/analytics).

## License

MIT
