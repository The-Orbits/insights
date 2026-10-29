// The two SvelteKit modules the sveltekit entries import, as far as they use them. SvelteKit resolves them in the app.
declare module "$app/environment" {
  export const browser: boolean;
}

declare module "$app/stores" {
  export const page: {
    subscribe(run: (page: { route: { id: string | null }; url: URL }) => void): () => void;
  };
}
