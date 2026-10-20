export {};
declare global {
  interface CloudflareEnv {
    API: { fetch: typeof fetch };
    ANADE_CLOUDFLARE: string;
  }
}
