// A page for the loaders' tests: a <head> that collects scripts, a host, and a console that records.
export function fakePage(hostname = "shop.kudi.ng") {
  const scripts: { src: string; defer: boolean; dataset: Record<string, string> }[] = [];
  const logs: unknown[][] = [];
  Object.assign(globalThis, {
    window: globalThis,
    location: { hostname },
    document: {
      createElement: () => ({ dataset: {} }),
      head: {
        querySelector: (selector: string) => scripts.find((s) => selector === `script[src="${s.src}"]`) ?? null,
        appendChild: (s: (typeof scripts)[number]) => scripts.push(s),
      },
    },
  });
  for (const k of ["oa", "oaq", "osi", "osiq"]) delete (globalThis as Record<string, unknown>)[k];
  const info = console.info;
  console.info = (...args: unknown[]) => void logs.push(args);
  return { scripts, logs, restore: () => (console.info = info) };
}
