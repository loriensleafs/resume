// The chat's server route, POST /api/chat (SPEC-chat, Project Structure, "The route file"). It is a composition root,
// one of the route files where the site, the chat and the deploy module meet (SPEC-site, Objective): it builds the
// chat's ChatDeps and answers with handleChat(). The route has a server part only, so TanStack Start leaves it out of
// the browser's route tree (@tanstack/start-plugin-core, pruneServerOnlySubtrees()) and the browser never loads this
// module. The chat's Vite plugin also refuses virtual:knowledge to the browser's build (src/chat/vite-plugin.ts).
//
// This module reads process.env once, when the function instance loads it: a Vercel function's variables are set by
// then, and they do not change while the instance runs. The production deployment alone has VERCEL_ENV "production".

import { anthropicText } from "@tanstack/ai-anthropic";
import { createFileRoute } from "@tanstack/react-router";
import knowledge from "virtual:knowledge";
import { scriptedModel } from "../../chat/server/__tests__/fixtures";
import { handleChat, type ChatDeps } from "../../chat/server/handle-chat";
import { createOps } from "../../ops/ops";
import { SITE_ADDRESS } from "../page-head";

/** VERCEL_ENV alone picks the model; no other variable switches it (SPEC-deploy, "Changes to other specs", item 11). */
const production = process.env.VERCEL_ENV === "production";

/**
 * The question log, budget and telemetry, built once per function instance, so every request of the instance uses the
 * same parts: outside production the in-memory log, and in production the capped day and the once-a-day storefail
 * push (SPEC-deploy, "The question log, daily totals, alerts and status"). createOps() reads VERCEL_ENV itself.
 */
const ops = createOps(process.env);

/**
 * The Origin values the chat accepts (SPEC-chat, The request, "Origin"). In production: the site's address and the
 * deployment's own, so the list is never empty there. An empty list means the request's own origin, which a proxy that
 * rewrites the scheme or the host can change (C4's review), so only previews and `bun run dev` use it.
 */
const origins = production
  ? [SITE_ADDRESS, ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : [])]
  : [];

/**
 * Sonnet 5.5, the production model (decision 0013), new for each request: anthropicText() throws when no key is set, as
 * on the first deployment (SPEC-deploy, Setup list). There the chat answers 500 with no detail (Nitro's production
 * error handler), and the function's other routes keep working, as they would not if this module threw when it loads.
 *
 * The retries are the SDK's own two, set here so an SDK upgrade cannot change them. The SDK retries a model call whose
 * answer fails to start with 408, 409, 429 or 5xx (@anthropic-ai/sdk 0.135.0, shouldRetry()), so a short overload
 * does not fail a visitor's turn. Anthropic's spend limits still reach the handler as SPEND_LIMIT: the workspace limit
 * is a 400, which the SDK never retries, and the tier's cap is a 429 with no retry-after (research 12), so it comes
 * after the SDK's two backoffs, at most 1.5 s in all. Then budget.reserve() refuses for an hour with no model call
 * (SPEC-deploy, "The monthly limit"), so only the hour's probe waits. The SDK waits as long as a retry-after asks, and
 * the 120 s deadline still ends the turn (SPEC-chat, Limits).
 */
const sonnet = () => anthropicText("claude-sonnet-5-5", { maxRetries: 2 });

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleChat(request, {
          // Outside production, the fake model with the scripted turns, whatever variables are set, an
          // ANTHROPIC_API_KEY included (SPEC-chat, Tech Stack). It is new for each request (fixtures.ts).
          adapter: production ? sonnet() : scriptedModel(),
          knowledge,
          log: ops.log,
          budget: ops.budget,
          telemetry: ops.telemetry,
          origins,
          now: () => new Date(),
          // No testMiddleware: it is for seam-1 tests only, and the Omit makes the type check refuse it here.
        } satisfies Omit<ChatDeps, "testMiddleware">),
    },
  },
});
