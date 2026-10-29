import { useParams, usePathname } from "next/navigation";
import { Suspense } from "react";
import { computeRoute, type SpeedInsightsOptions } from "./index";
import { SpeedInsights as Base } from "./react";

export type { BeforeSend, SpeedInsightsOptions } from "./index";

function Tracked(props: SpeedInsightsOptions) {
  const params = useParams();
  const path = usePathname();
  return <Base {...props} route={computeRoute(path, params) ?? path} />;
}

/** Reports Core Web Vitals with the route that served the page, such as /blog/[slug]. Put it in the root layout. */
export function SpeedInsights(props: Omit<SpeedInsightsOptions, "route">) {
  // The URL hooks read the request: behind a boundary, the rest of the layout stays in the static shell.
  return (
    <Suspense fallback={null}>
      <Tracked {...props} />
    </Suspense>
  );
}
