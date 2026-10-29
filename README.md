# Orbits Insights

Analytics and Speed Insights for apps on [Orbits](https://orbits.africa).

| Package | What it measures |
| --- | --- |
| [`@useorbits/analytics`](packages/analytics) | Page views, single-page navigations included, by route, and custom events with `track()`. |
| [`@useorbits/speed-insights`](packages/speed-insights) | Core Web Vitals (LCP, INP, CLS, FCP, TTFB) from real visits, with the element behind each slow one. |

The packages are loaders. The code that measures and sends is in [`packages/script`](packages/script), built into
`/_orbits/analytics.js` and `/_orbits/speed-insights.js`, which Orbits' edge serves on a project's own address once the
feature is on, for production deployments only. A change to what's measured ships with Orbits, without anyone updating
a package.

No cookies are set, nothing is sent in development, and Orbits keeps neither the visitor's IP address nor their
browser: a visitor is a hash that changes every day. Turn the pages on in your project's **Analytics** and
**Speed Insights** tabs.

## Next.js

```sh
npm install @useorbits/analytics @useorbits/speed-insights
```

```tsx
// app/layout.tsx
import { Analytics } from "@useorbits/analytics/next";
import { SpeedInsights } from "@useorbits/speed-insights/next";

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

There are components for React (`/react`), Vue (`/vue`), SvelteKit (`/sveltekit`) and Astro (`/astro`), and
`inject()` / `injectSpeedInsights()` for anything else. A site without a bundler can add the scripts directly:

```html
<script defer src="/_orbits/analytics.js"></script>
<script defer src="/_orbits/speed-insights.js"></script>
```

Each package's README has the details: custom events, `beforeSend`, sampling.

## Developing

```sh
bun install
bun test
bun run build
```

`packages/script/dist/*.js` is what the edge serves: copy it into orbits-backend's `infra/staging/insights/` to ship a
change. Package releases are tags: `analytics@0.2.0` or `speed-insights@0.2.0`, matching the version in that package's
`package.json`. The Release workflow publishes it to npm with provenance.
