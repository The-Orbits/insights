// The Next.js hooks the next entries use. The app's own Next resolves them; the published types don't mention them.
declare module "next/navigation" {
  export function useParams(): Record<string, string | string[]> | null;
  export function usePathname(): string | null;
}
