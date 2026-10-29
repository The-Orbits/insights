import { useParams, usePathname } from "next/navigation";
import { Suspense } from "react";
import { computeRoute } from "./index";
import { Analytics as Base, type AnalyticsProps } from "./react";

export { track, type AnalyticsOptions, type BeforeSend } from "./index";

function Tracked(props: AnalyticsProps) {
  const params = useParams();
  const path = usePathname();
  return <Base {...props} route={computeRoute(path, params) ?? path} path={path} />;
}

/** Counts page views with the route that served each one, such as /blog/[slug]. Put it in the root layout. */
export function Analytics(props: Omit<AnalyticsProps, "route" | "path">) {
  // The URL hooks read the request: behind a boundary, the rest of the layout stays in the static shell.
  return (
    <Suspense fallback={null}>
      <Tracked {...props} />
    </Suspense>
  );
}
