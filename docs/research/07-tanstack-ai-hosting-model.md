# TanStack AI 1.0, hosting and the model

Researched 2026-10-26 from the official TanStack AI, Vercel, Cloudflare, Bun and Anthropic docs.

## TanStack AI 1.0 (released 2026-10-22)

- Server: `chat({ adapter, systemPrompts, messages, threadId })` returns a stream. `chatParamsFromRequest(request)` reads the client's body; `toServerSentEventsResponse(stream)` returns a Web `Response`, so it runs on any Web-standard server, Bun included. (Docs: getting-started/quick-start-server, chat/streaming.)
- Client: `useChat({ connection: fetchServerSentEvents("/api/chat"), threadId })` from `@tanstack/ai-react`. A TanStack Start server function can be the transport instead (`fetcher`). SSE is the documented default. (chat/connection-adapters.)
- Anthropic adapter: `anthropicText("claude-sonnet-5-5")`; the model list includes `claude-haiku-5-5`, `claude-sonnet-5-5` and `claude-opus-5-5`. Claude 5-generation models reject `temperature`, `top_p` and `top_k`, so grounding comes from the prompt, the knowledge file and the evals, not sampling settings. (adapters/anthropic.)
- Prompt caching is on by default; `chat()` uses `threadId` as the cache key. (advanced/prompt-caching.)
- Tests: `fakeText()` from `@tanstack/ai/testing` scripts model answers with no network or key. (advanced/testing.)
- Built-in middleware includes `contentGuardMiddleware` and `otelMiddleware`. `decide()` asks a decision model typed questions; its adapter is TypeSafe's Jev (`@tanstack/ai-typesafe`), which could grade chat answers in evals. (advanced/built-in-middleware, evaluate.)
- 1.0 needs every `@tanstack/ai*` package on 1.0 together, and a stable `threadId` per conversation. (migration/v1.)

## Hosting

- **Vercel** runs Bun functions (public beta since 2025-10-28; Bun 1.4 since 2026-08-20) with `"bunVersion": "1.x"` in `vercel.json`. Supported frameworks include Nitro, which TanStack Start uses. https://vercel.com/changelog (Bun runtime entries)
- TanStack Start on Vercel: add the `nitro()` Vite plugin; Vercel detects TanStack Start and Nitro with no config, and server routes run as Vercel Functions. https://vercel.com/kb/guide/deploy-a-tanstack-start-app-to-vercel
- Bun's guide: run Vite with `bun --bun vite dev|build`; on Vercel set `bunVersion` and do not use Nitro's `bun` preset. https://bun.com/docs/guides/ecosystem/tanstack-start.md
- Vercel Hobby is free and for non-commercial personal use only. Vercel Pro is a $20/month platform fee with one deploying seat and $20 of monthly usage credit, spend notifications and actions, and one free first-year domain on eligible TLDs (including .dev and .app). https://vercel.com/docs/plans/hobby, https://vercel.com/docs/plans/pro-plan
- Vercel WAF rate limiting is available on all plans (fixed window, keyed by IP); Hobby allows one rate-limit rule. https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- **Cloudflare Workers** run on Cloudflare's own runtime, not Bun, and its Wrangler CLI requires Node.js. The free plan allows 100,000 requests a day and 10 ms of CPU per request. https://developers.cloudflare.com/workers/
- **Railway**: Hobby $5/month and Pro $20/seat/month according to a third-party tracker (PricingSaaS, captured 2026-09-21); not verified with Railway.

## Model prices (Anthropic, per million tokens)

| Model | Input | Output | Cache hit |
|---|---|---|---|
| Claude Haiku 5.5 (prompt up to 100k tokens) | $0.10 | $0.50 | $0.01 |
| Claude Sonnet 5.5 | $2 | $10 | $0.10 |
| Claude Opus 5.5 | $4 | $20 | $0.20 |

https://platform.claude.com/docs/en/about-claude/pricing

Estimate for this chat: a knowledge file of about 15,000 tokens, mostly served from the cache, and answers of about 300 tokens. Sonnet 5.5 is then about $5–$10 per 1,000 questions; Haiku 5.5 about $0.30–$2.

## Spend controls

- Anthropic workspaces support monthly spend limits per workspace (Anthropic, 2024-09-10). Setting organization and workspace limits through the API is an early-access preview. Whether reaching a limit stops requests is not stated; check in the Console at setup. https://claude.com/resources/articles/workspaces, https://platform.claude.com/docs/en/api/beta/organization/spend_limits
- Vercel Pro sends usage notifications and supports spend thresholds with automatic actions. https://vercel.com/docs/plans/pro-plan
