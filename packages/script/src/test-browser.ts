// Just enough browser for the scripts: a location that history moves, events, a script element and fetch.
export type FakeBrowser = {
  sent: Record<string, string>[];
  script: HTMLScriptElement;
  go: (path: string) => void;
  back: (path: string) => void;
  hide: () => void;
};

export function fakeBrowser({ path = "/", referrer = "https://www.google.com/", dataset = {} as Record<string, string>, agent = "Mozilla/5.0" } = {}): FakeBrowser {
  const sent: Record<string, string>[] = [];
  const listeners = new Map<string, (() => void)[]>();
  const location = new URL(`https://shop.kudi.ng${path}`);
  const document = { referrer, visibilityState: "visible" };
  const fire = (type: string) => listeners.get(type)?.forEach((f) => f());
  const history = {
    pushState(_state: unknown, _title: string, url?: string) {
      if (url) location.pathname = url;
    },
  };
  const ds: Record<string, string> = { ...dataset };
  const script = { dataset: ds, setAttribute: (name: string, value: string) => (ds[name.replace(/^data-/, "")] = value) } as unknown as HTMLScriptElement;
  Object.assign(globalThis, {
    window: globalThis,
    location,
    history,
    document,
    navigator: { webdriver: false, userAgent: agent, connection: { effectiveType: "3g" } },
    addEventListener: (type: string, f: () => void) => listeners.set(type, [...(listeners.get(type) ?? []), f]),
    fetch: async (url: string) => {
      sent.push(Object.fromEntries(new URLSearchParams(url.split("?")[1])));
      return new Response(null);
    },
  });
  for (const k of ["oa", "oaq", "osi", "osiq"]) delete (globalThis as Record<string, unknown>)[k];
  return {
    sent,
    script,
    go: (p) => history.pushState(null, "", p),
    back: (p) => {
      location.pathname = p;
      fire("popstate");
    },
    hide: () => {
      document.visibilityState = "hidden";
      fire("visibilitychange");
    },
  };
}
