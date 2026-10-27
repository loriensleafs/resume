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

## SPEC-chat's TanStack AI names in the 1.0.0 packages (checked 2026-10-27, task C1)

C1 installed `@tanstack/ai`, `@tanstack/ai-react` and `@tanstack/ai-anthropic` 1.0.0 and `@tanstack/markdown` 0.0.13 at exact versions. Each package ships its TypeScript source, so each verdict cites a file and line under `node_modules/`. Only `@tanstack/ai` ships skills (`bun run intent list`). Its skills say they target 0.42.0, and two are out of date against the 1.0.0 source: `ai-core/middleware` has no `onGuardToolCall`, and `ai-core/ag-ui-protocol` says `chatParamsFromRequestBody()` checks the body with `RunAgentInputSchema` and keeps message `parts`. The source decides.

Same: the package has the name and the behavior SPEC-chat states. Differs: the package has the name, but not the behavior the spec needs. Missing: the package does not have the name. Paths start at `node_modules/@tanstack/`.

| Name in SPEC-chat | Verdict | Source |
|---|---|---|
| `chat()` | same | `ai/src/activities/chat/index.ts:6128`, exported at `ai/src/index.ts:3`; skill `ai-core` |
| `chatParamsFromRequestBody()` | same | `ai/src/utilities/chat-params.ts:204`. It throws on a bad body. The body must hold `threadId`, `runId` and the arrays `messages`, `tools` and `context` (lines 215–226), and the client sends all five (`ai-client/src/connection-adapters.ts:1415–1429`). `chatParamsFromRequest()` throws a plain-text 400 `Response` (lines 276–306), as the spec says. Skill `ai-core/ag-ui-protocol` |
| `toServerSentEventsResponse` | same | `ai/src/stream-to-response.ts:1059`; skills `ai-core`, `ai-core/chat-experience`. See finding 2 |
| `fakeText()` | same | `ai/src/testing/fake-text.ts:378`, from `@tanstack/ai/testing` (`ai/src/testing.ts:2`). `setResponses()` queues answers (line 168); a step can be a function of the request (lines 41–46); an empty queue answers with `RUN_ERROR` (lines 182–186). No skill |
| `anthropicText()` | same | `ai-anthropic/src/adapters/text.ts:2430`. It reads `ANTHROPIC_AUTH_TOKEN`, then `ANTHROPIC_OAUTH_TOKEN`, then `ANTHROPIC_API_KEY` (`ai-anthropic/src/utils/client.ts:80–108`), as the spec says. `claude-sonnet-5-5` is in the model list (`ai-anthropic/src/model-meta.ts:674`). Skill `ai-core/adapter-configuration` |
| `createAnthropicChat()` | same | `ai-anthropic/src/adapters/text.ts:2393`: `(model, apiKey, config?)`; it reads no variable. No skill |
| `createAnthropicChatWithClient()` | same | `ai-anthropic/src/adapters/text.ts:2411`: `(model, client)`; the client type `AnthropicMessagesClient` is exported (`ai-anthropic/src/index.ts`). No skill |
| `onGuardToolCall` | same | `ai/src/activities/chat/middleware/types.ts:897`; the hook context has `toolName` (line 457); the decision `{ type: "skip", result }` (line 484). It runs after the `onBeforeToolCall` hooks and after the input check (`ai/src/activities/chat/tools/tool-calls.ts:1242–1343`), so an input that fails the check never reaches it. See finding 3. No skill |
| `onBeforeToolCall` | same | `ai/src/activities/chat/middleware/types.ts:879`; first non-void decision wins (`middleware/compose.ts:511–541`); skill `ai-core/middleware` |
| `onConfig` | same | `ai/src/activities/chat/middleware/types.ts:775`. It runs at `init` and before each model call, with `ctx.iteration` set to the 0-based model call (`index.ts:1641–1652`), so the sixth call has iteration 5. A returned `toolChoice` applies to that call only (`types.ts:372–377`). Skill `ai-core/middleware` |
| `onChunk` | same | `ai/src/activities/chat/middleware/types.ts:863`; a returned event replaces the event, an array expands it, `null` drops it (`compose.ts:380–472`); skill `ai-core/middleware` |
| `onUsage` | same | `ai/src/activities/chat/middleware/types.ts:930`. The engine calls it only for `RUN_FINISHED` (`index.ts:2227–2229`). The Anthropic adapter ends a `max_tokens` stop with `RUN_ERROR` code `max_tokens`, which carries `usage` (`ai-anthropic/src/adapters/text.ts:2246–2280`), so `onUsage` does not run for it. Skill `ai-core/middleware` |
| The terminal hook with `ctx.defer()` | same | Exactly one of `onFinish`, `onAbort` and `onError` runs per run (`types.ts:935–960`); an adapter `RUN_ERROR` leads to `onError` (`index.ts:1500–1522`). `ctx.defer()` (`types.ts:264`) keeps a promise that the run awaits with `Promise.allSettled` in its `finally`, after the terminal hook (`index.ts:1335–1337`, `1796–1806`), so the stream closes after the log writes and a failed write does not break it. Skill `ai-core/middleware` |
| `agentLoopStrategy: maxIterations()` | same | `ai/src/activities/chat/agent-loop-strategies.ts:26` (`iterationCount < max`); the option at `index.ts:663`. Without the option the default is `maxIterations(5)` with `untilFinishReason(["length"])` (lines 658–662). Skills `ai-core/middleware`, `ai-core/tool-calling` |
| `toolChoice: "none"` | same | `ai/src/types.ts:1295`; the `chat()` option at `index.ts:702`. The Anthropic adapter sends `{ type: "none" }`, also for a model that cannot force a tool (`ai-anthropic/src/adapters/text.ts:213–221`, `1135–1146`). No skill |
| `reasoning: { level, summary }` | same | `ai/src/reasoning.ts:46`; `summary` defaults to `true` (line 106). For Sonnet 5.5 the adapter sends `thinking: { type: "adaptive", display: "omitted" }` with `summary: false`, and `output_config.effort: "medium"` (`ai-anthropic/src/text/reasoning.ts:39–69`; levels at `model-meta.ts:40–49`). Skill `ai-core/adapter-configuration`. See finding 1 |
| `modelOptions.max_tokens` | same | `ai-anthropic/src/adapters/text.ts:1025–1031`, `1119`. Adaptive thinking adds no budget, so the request's `max_tokens` is the value given. Skill `ai-core/adapter-configuration` |
| `promptCache` | same | The `chat()` option at `index.ts:704–714`: default `"short"`, key `threadId`. The Anthropic adapter sends `{ type: "ephemeral" }` for `"short"` (5 minutes) and a 1-hour `ttl` for `"long"` (`ai-anthropic/src/prompt-cache.ts:138–148`). No skill |
| `wireContent` | same (not a public name) | A local variable in the engine's `buildToolResultChunks()` (`index.ts:4198–4344`). The tool message keeps `content`; the `TOOL_CALL_RESULT` event gets `content: wireContent`. The message is stored before the event passes `onChunk`, so a replaced event does not change what the model reads next. A `MESSAGES_SNAPSHOT`, which would carry the full tool message, is sent only at an interrupt (`index.ts:3974`), and the chat's tools have none. No skill |
| `RUN_ERROR` | same | `ai/src/types.ts:1663–1700`. Besides `message`, `code`, `rawEvent`, `metadata` and `usage`, the event can carry `error` (the provider's message again), `errorType`, `requestId`, `retryAfterMs`, `rawText`, `threadId`, `runId` and `model`. So the wire middleware builds a new `{ type, code, message }` event; deleting three fields is not enough. Skill `ai-core/ag-ui-protocol`. See finding 2 |
| `CUSTOM` | same | `ai/src/types.ts:1812` (`name`, `value`); a middleware sends one with `ctx.emitCustomEvent(name, value)` (`middleware/types.ts:252`). Skill `ai-core/ag-ui-protocol` |
| `TOOL_CALL_RESULT` | same | `ai/src/types.ts:1764`; `content` is a string (`index.ts:4243–4251`). No skill |
| `useChat`'s `initialMessages` | same | `ai-react/src/use-chat.ts:66`, `106`; skill `ai-core/chat-experience` |
| `useChat`'s `threadId` | same | `ai-react/src/use-chat.ts:107`; the hook makes one client per `threadId` (line 187) |
| `useChat`'s `sendMessage` `body` | same | `sendMessage(content, { body })` (`ai-react/src/types.ts:197–200`); `body` is merged into the request's `forwardedProps` (`ai-client/src/types.ts:520–533`). `sendMessage({ content, metadata })` copies `metadata` onto the question's `UIMessage` (`ai-client/src/types.ts:418–440`) |
| Types `AnyTextAdapter`, `ChatMiddleware`, `UIMessage` | same | `ai/src/activities/chat/adapter.ts:237`, `middleware/types.ts:706`, `ai/src/types.ts:805` |

The spec's claims about `useChat` also hold: its queue drops queued questions on Stop and on an error (`ai-client/src/types.ts:1123–1131`, `chat-client.ts:2907–2912`), and its storage adapters write the whole conversation as one record on every change (`ai-client/src/client-persistor.ts:39`, `109`).

### Findings for the behavior SPEC-chat relies on

1. **Differs: every follow-up question fails the request check.** Sonnet 5.5 always thinks. With `display: "omitted"` Anthropic still returns each thinking block's signature "for multi-turn continuity" (`@anthropic-ai/sdk/resources/messages/messages.d.ts:3946`; Anthropic thinking docs, "Controlling thinking display"). The adapter streams it as `REASONING_ENCRYPTED_VALUE` (`ai-anthropic/src/adapters/text.ts:2045–2060`). The browser's stream processor turns it into a `thinking` part with empty text (`ai/src/activities/chat/stream/processor.ts:3035–3070`). On the next question the client sends that part as a `{ role: "reasoning", content: "", encryptedValue }` row (`ai/src/utilities/ag-ui-wire.ts:371–380`, `ai-client/src/connection-adapters.ts:1409`). SPEC-chat's request check (The request, step 4) passes only `user`, `assistant` and `tool`, so it answers 400 `INVALID_REQUEST` to every question after the first answer. The spec needs an amendment; the options are in C1's report. Facts for the choice: the engine stores the raw adapter events before `onChunk` (`index.ts:2094` before `2172`), so a wire rule that drops `REASONING_*` events keeps the signature the tool loop needs inside one turn. Anthropic needs thinking blocks back only inside a tool-use turn, and allows leaving out earlier turns' thinking (thinking docs, "Preserving thinking blocks"). A returned block stays valid only while the system prompt, the tools and the earlier messages stay unchanged (thinking docs, "Preserved thinking"), and this chat changes them on purpose: the scope and audience lines, the 20-turn window and the ids-only reads.
2. **A thrown run skips the `RUN_ERROR` rewrite.** When the `chat()` stream throws, `toServerSentEventsResponse` writes its own `RUN_ERROR` with the error's own message (`ai/src/stream-to-response.ts:279–296`, `ai/src/activities/error-payload.ts:76`), and that event never passes `onChunk`. The Anthropic adapter catches its own errors and sends `RUN_ERROR` (`ai-anthropic/src/adapters/text.ts:2341–2372`), but a throw from a hook or the engine still reaches the wire this way. To keep SPEC-chat's rule ("every `RUN_ERROR` on the wire holds only its code and the fixed message"), `handleChat()` wraps the stream and turns a throw into its own `RUN_ERROR`.
3. **A guard runs after every `onBeforeToolCall` transform, not after a skip.** A `skip` or `abort` decision from an `onBeforeToolCall` ends the call before the input check and the guard (`ai/src/activities/chat/tools/tool-calls.ts:1257`). The tool does not run then, so no read happens and the read budget stays right. With parallel tool runs (the default), the guards still run one call at a time, in call order (`tool-calls.ts:1328`, inside the preparation loop).
4. **Error codes.** The adapter's code for the output cap is `max_tokens` in lower case; `MAX_TOKENS` is the handler's own code, which the wire middleware maps. An Anthropic API error's code is its HTTP status, or `context_overflow` for a prompt that is too long (`ai-anthropic/src/adapters/text.ts:2381–2385`).
5. **The preview's fake model.** One `fakeText()` adapter keeps one queue, and each model call takes the next answer (`ai/src/testing/fake-text.ts:182–186`). The route therefore makes a new fake for each request, or queues a function step that picks the scripted turn from the request's question text.
6. **Omitted thinking on the wire.** With `display: "omitted"` no thinking text streams, but the adapter still sends empty `REASONING_START`, `REASONING_MESSAGE_START` and `REASONING_END` events and the signature (`ai-anthropic/src/adapters/text.ts:1874–1893`, `2045–2070`). The signature is encrypted thinking, not text.
