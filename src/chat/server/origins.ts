// The Origin values the chat accepts (SPEC-chat, The request, "Origin"), from the deployment's variables. The chat's
// route file passes them to handleChat() as ChatDeps.origins.

import { SITE_ADDRESS } from "../../site/page-head";

/** What chatOrigins() reads from the environment. */
export type OriginsEnv = {
  VERCEL_ENV?: string; // "production" on the production deployment alone
  VERCEL_URL?: string; // the deployment's own host, with no scheme, such as resume-abc123.vercel.app
};

// process.env's type declares these variables, as Bun's docs say to type them ("Environment variables", TypeScript).
// So `chatOrigins(process.env)` passes the type check with no cast, and a misspelled key in an object fails it.
declare module "bun" {
  interface Env extends OriginsEnv {}
}

/**
 * The allowed Origin values. In production: the site's address and, when VERCEL_URL is set, the deployment's own, so
 * the list is never empty there. Elsewhere, no values: the handler then accepts the request's own origin, which a
 * proxy that rewrites the scheme or the host can change (C4's review), so only previews and `bun run dev` use it.
 */
export function chatOrigins(env: OriginsEnv): string[] {
  if (env.VERCEL_ENV !== "production") return [];
  return env.VERCEL_URL ? [SITE_ADDRESS, `https://${env.VERCEL_URL}`] : [SITE_ADDRESS];
}
