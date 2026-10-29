# Orbits Insights

Analytics and Speed Insights for apps on [Orbits](https://orbits.africa).

| Package | What it sends |
| --- | --- |
| [`@theorbits/analytics`](packages/analytics) | A page view for each page a visitor sees, including a single-page app's own navigations. |
| [`@theorbits/speed-insights`](packages/speed-insights) | Core Web Vitals (LCP, INP, CLS, FCP, TTFB) from real visits, measured with Google's [`web-vitals`](https://github.com/GoogleChrome/web-vitals). |

Both send a small `GET /_orbits/e` beacon to your site's own address, which Orbits' edge answers. No cookies are set, nothing is sent from `localhost`, and Orbits keeps neither the visitor's IP address nor their browser: a visitor is a hash that changes every day. Turn the pages on in your project's **Analytics** and **Speed Insights** tabs.

## Next.js

```sh
npm install @theorbits/analytics @theorbits/speed-insights
```

```tsx
// app/layout.tsx
import { Analytics } from "@theorbits/analytics/next";
import { SpeedInsights } from "@theorbits/speed-insights/next";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

## React (Vite, React Router, …)

```tsx
import { Analytics } from "@theorbits/analytics/react";
import { SpeedInsights } from "@theorbits/speed-insights/react";

// once, near the root
<Analytics />
<SpeedInsights />
```

## Anything else (Vue, Svelte, Astro, plain HTML)

```ts
import { inject } from "@theorbits/analytics";
import { injectSpeedInsights } from "@theorbits/speed-insights";

inject();
injectSpeedInsights();
```

Call them once in code that runs in the browser (in SvelteKit, `onMount` in the root layout; in Astro, a `<script>` in the layout).

## Options

| Option | Packages | Default | |
| --- | --- | --- | --- |
| `debug` | both | `false` | Also send from `localhost`, and log each beacon to the console. |
| `endpoint` | both | `/_orbits/e` | Where beacons go. |
| `sampleRate` | speed-insights | `1` | The share of page loads that report, 0 to 1. |

## Developing

```sh
bun install
bun test
bun run build
```

Releases are tags: `analytics@0.2.0` or `speed-insights@0.2.0`, matching the version in that package's `package.json`. The Release workflow publishes it to npm with provenance.
