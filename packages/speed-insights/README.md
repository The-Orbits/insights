# `@useorbits/speed-insights`

Core Web Vitals from real visits to apps on [Orbits](https://orbits.africa): how fast your pages load and respond for
the people actually using them, on their own phones and networks.

Each page load reports LCP, INP, CLS, FCP and TTFB, measured with Google's
[`web-vitals`](https://github.com/GoogleChrome/web-vitals), as small `GET /_orbits/e` requests to your site's own
address, which Orbits' edge answers. No cookies, no IP addresses stored, nothing sent from `localhost`. Your project's
**Speed Insights** tab shows the 75th percentile of each metric, a score out of 100, and your slowest routes, for mobile
and desktop.

## Install

```sh
npm install @useorbits/speed-insights
```

Then open your project on Orbits, go to the **Speed Insights** tab and press **Turn on Speed Insights**.

## Next.js

Put `<SpeedInsights />` in the root layout, once:

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

## React (Vite, React Router, TanStack Router, …)

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

## Any other framework, or none

Call `injectSpeedInsights()` once in code that runs in the browser:

```ts
import { injectSpeedInsights } from "@useorbits/speed-insights";

injectSpeedInsights();
```

- **Vue:** in `main.ts`, after `createApp(...)`.
- **SvelteKit:** in `onMount` in the root `+layout.svelte`.
- **Astro:** in a `<script>` in your base layout.
- **Plain HTML with a bundler:** in your entry file.

It does nothing on the server, so it's safe to call from code that runs in both places.

## Options

`<SpeedInsights />` takes the same options as `injectSpeedInsights()`:

| Option | Default | |
| --- | --- | --- |
| `sampleRate` | `1` | The share of page loads that report, from 0 to 1. Lower it on a busy site: `0.5` reports half. |
| `debug` | `false` | Also send from `localhost`, and log each metric to the console. |
| `endpoint` | `"/_orbits/e"` | Where reports go. You won't normally change it. |

```tsx
<SpeedInsights sampleRate={0.5} />
```

## What's measured

| Metric | What it tells you | Good |
| --- | --- | --- |
| **LCP**, Largest Contentful Paint | When the main content appeared | 2.5 s or less |
| **INP**, Interaction to Next Paint | How quickly the page responds to taps and clicks | 200 ms or less |
| **CLS**, Cumulative Layout Shift | How much the layout jumps around while loading | 0.1 or less |
| **FCP**, First Contentful Paint | When anything first appeared | 1.8 s or less |
| **TTFB**, Time to First Byte | How long the server took to start answering | 0.8 s or less |

Each metric is reported against the path the page loaded on. The score weighs FCP, LCP, INP and CLS the way Lighthouse
does. TTFB is shown but not scored.

## Off Orbits

On a host that isn't Orbits, `/_orbits/e` is a plain 404. Nothing breaks, and nothing is collected.

## Analytics

To also count visitors and page views, add
[`@useorbits/analytics`](https://www.npmjs.com/package/@useorbits/analytics).

## License

MIT
