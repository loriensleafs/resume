# TanStack AI 1.0, hosting and the model

Researched 2026-10-26 from the official TanStack AI, Vercel, Cloudflare, Bun and Anthropic docs.

## TanStack AI 1.0 (released 2026-10-22)

These lines come from the docs. C1 checked SPEC-chat's names against the installed 1.0.0 packages on 2026-10-27: see [SPEC-chat's TanStack AI names in 1.0.0](#spec-chats-tanstack-ai-names-in-100).

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

## SPEC-chat's TanStack AI names in 1.0.0

Checked on 2026-10-27 for task C1. C1 installed `@tanstack/ai`, `@tanstack/ai-react` and `@tanstack/ai-anthropic` 1.0.0 and `@tanstack/markdown` 0.0.13 at exact versions. Each package ships its TypeScript source, so each verdict cites a file and line under `node_modules/@tanstack/` (the paths below start there).

Only `@tanstack/ai` ships skills (`bun run intent list`). Its skills say they target 0.42.0, and two are out of date against the 1.0.0 source: `ai-core/middleware` has no `onGuardToolCall`, and `ai-core/ag-ui-protocol` says `chatParamsFromRequestBody()` checks the body with `RunAgentInputSchema` and keeps message `parts`. Where a skill and the source differ, the source decides. Each skill below is named in full; load one with `bun run intent load @tanstack/ai#ai-core/middleware`, not `#middleware`.

The verdict words:

- **same**: the package has the name, and the behavior SPEC-chat states holds.
- **differs**: the package has the name, but a behavior SPEC-chat relied on does not hold. The finding named in the row says what differs and what changed in the spec.
- **missing**: the package does not have the name. No row has this verdict.

| Name in SPEC-chat | Verdict | Evidence: installed file and line, and skill |
|---|---|---|
| `chat()` | same | `ai/src/activities/chat/index.ts:6128`, exported at `ai/src/index.ts:3`; skill `ai-core` |
| `chatParamsFromRequestBody()` | same | `ai/src/utilities/chat-params.ts:204`. It throws on a bad body. The body must hold `threadId`, `runId` and the arrays `messages`, `tools` and `context` (lines 215–226), and the client sends all five (`ai-client/src/connection-adapters.ts:1415–1429`). `chatParamsFromRequest()` throws a plain-text 400 `Response` (lines 276–306), as the spec says. Skill `ai-core/ag-ui-protocol` |
| `toServerSentEventsResponse` | differs (finding 2) | `ai/src/stream-to-response.ts:1059`. When the stream throws, it writes its own `RUN_ERROR` with the error's own message (lines 279–296), past every middleware. Skills `ai-core`, `ai-core/chat-experience` |
| `fakeText()` | same | `ai/src/testing/fake-text.ts:378`, from `@tanstack/ai/testing` (`ai/src/testing.ts:2`). `setResponses()` queues answers (line 168); a step can be a function of the request (lines 41–46); an empty queue answers with `RUN_ERROR` (lines 182–186). No skill |
| `anthropicText()` | same | `ai-anthropic/src/adapters/text.ts:2430`. It reads `ANTHROPIC_AUTH_TOKEN`, then `ANTHROPIC_OAUTH_TOKEN`, then `ANTHROPIC_API_KEY` (`ai-anthropic/src/utils/client.ts:80–108`), as the spec says. `claude-sonnet-5-5` is in the model list (`ai-anthropic/src/model-meta.ts:674`). Skill `ai-core/adapter-configuration` |
| `createAnthropicChat()` | same | `ai-anthropic/src/adapters/text.ts:2393`: `(model, apiKey, config?)`; it reads no variable. No skill |
| `createAnthropicChatWithClient()` | same | `ai-anthropic/src/adapters/text.ts:2411`: `(model, client)`; the client type `AnthropicMessagesClient` is exported (`ai-anthropic/src/index.ts`). No skill |
| `onGuardToolCall` | same | `ai/src/activities/chat/middleware/types.ts:897`; the hook context has `toolName` (line 457); the decision `{ type: "skip", result }` (line 484). It runs after the `onBeforeToolCall` hooks and after the input check (`ai/src/activities/chat/tools/tool-calls.ts:1242–1343`), so an input that fails the check never reaches it. Finding 3 corrects one sentence of the spec. No skill |
| `onBeforeToolCall` | same | `ai/src/activities/chat/middleware/types.ts:879`; the first non-void decision wins (`middleware/compose.ts:511–541`); skill `ai-core/middleware` |
| `onConfig` | same | `ai/src/activities/chat/middleware/types.ts:775`. It runs at `init` and before each model call, with `ctx.iteration` set to the 0-based model call (`index.ts:1641–1652`), so the sixth call has iteration 5. A returned `toolChoice` applies to that call only (`types.ts:372–377`). Skill `ai-core/middleware` |
| `onChunk` | same | `ai/src/activities/chat/middleware/types.ts:863`; a returned event replaces the event, an array expands it, `null` drops it (`compose.ts:380–472`); skill `ai-core/middleware` |
| `onUsage` | same | `ai/src/activities/chat/middleware/types.ts:930`. The engine calls it only for `RUN_FINISHED` (`index.ts:2227–2229`). The Anthropic adapter ends a `max_tokens` stop with `RUN_ERROR` code `max_tokens`, which carries `usage` (`ai-anthropic/src/adapters/text.ts:2246–2280`), so `onUsage` does not run for it. Skill `ai-core/middleware` |
| The terminal hook with `ctx.defer()` | same | Exactly one of `onFinish`, `onAbort` and `onError` runs per run (`types.ts:935–960`); an adapter `RUN_ERROR` leads to `onError` (`index.ts:1500–1522`). `ctx.defer()` (`types.ts:264`) keeps a promise that the run awaits with `Promise.allSettled` in its `finally`, after the terminal hook (`index.ts:1335–1337`, `1796–1806`). So the stream closes after the log writes, and a failed write does not break it. Skill `ai-core/middleware` |
| `agentLoopStrategy: maxIterations()` | same | `ai/src/activities/chat/agent-loop-strategies.ts:26` (`iterationCount < max`); the option at `index.ts:663`. Without the option, the default is `maxIterations(5)` with `untilFinishReason(["length"])` (lines 658–662). Skills `ai-core/middleware`, `ai-core/tool-calling` |
| `toolChoice: "none"` | same | `ai/src/types.ts:1295`; the `chat()` option at `index.ts:702`. The Anthropic adapter sends `{ type: "none" }`, also for a model that cannot force a tool (`ai-anthropic/src/adapters/text.ts:213–221`, `1135–1146`). No skill |
| `reasoning: { level, summary }` | differs (finding 1) | `ai/src/reasoning.ts:46`; `summary` defaults to `true` (line 106). For Sonnet 5.5 the adapter sends adaptive thinking with `display: "summarized"` for `summary: true` and `"omitted"` for `false`, and `output_config.effort: "medium"` (`ai-anthropic/src/text/reasoning.ts:39–69`; levels at `model-meta.ts:40–49`). Either way, each thinking block's signature streams too. Skill `ai-core/adapter-configuration` |
| `modelOptions.max_tokens` | same | `ai-anthropic/src/adapters/text.ts:1025–1031`, `1119`. Adaptive thinking adds no budget, so the request's `max_tokens` is the value given. Skill `ai-core/adapter-configuration` |
| `promptCache` | same | The `chat()` option at `index.ts:704–714`: default `"short"`, key `threadId`. The Anthropic adapter sends `{ type: "ephemeral" }` for `"short"` (5 minutes) and a 1-hour `ttl` for `"long"` (`ai-anthropic/src/prompt-cache.ts:138–148`). No skill |
| `wireContent` | same | A local variable in the engine's `buildToolResultChunks()` (`index.ts:4198–4344`), not a `chat()` option; the spec names it only to describe the engine. The tool message keeps `content`; the `TOOL_CALL_RESULT` event gets `content: wireContent`. The message is stored before the event passes `onChunk`, so a replaced event does not change what the model reads next. A `MESSAGES_SNAPSHOT`, which would carry the full tool message, is sent only at an interrupt (`index.ts:3974`), and the chat's tools have none. No skill |
| `RUN_ERROR` | differs (finding 2) | `ai/src/types.ts:1663–1700`. Besides `message`, `code`, `rawEvent`, `metadata` and `usage`, the event can carry `error` (the provider's message again), `errorType`, `requestId`, `retryAfterMs`, `rawText`, `threadId`, `runId` and `model`. So deleting three fields is not enough, and a thrown run's `RUN_ERROR` never passes the middleware. Skill `ai-core/ag-ui-protocol` |
| `CUSTOM` | same | `ai/src/types.ts:1812` (`name`, `value`); a middleware sends one with `ctx.emitCustomEvent(name, value)` (`middleware/types.ts:252`). Skill `ai-core/ag-ui-protocol` |
| `TOOL_CALL_RESULT` | same | `ai/src/types.ts:1764`; `content` is a string (`index.ts:4243–4251`). No skill |
| `useChat`'s `initialMessages` | same | `ai-react/src/use-chat.ts:66`, `106`; skill `ai-core/chat-experience` |
| `useChat`'s `threadId` | same | `ai-react/src/use-chat.ts:107`; the hook makes one client per `threadId` (line 187) |
| `useChat`'s `sendMessage` `body` | same | `sendMessage(content, { body })` (`ai-react/src/types.ts:197–200`); `body` is merged into the request's `forwardedProps` (`ai-client/src/types.ts:520–533`). `sendMessage({ content, metadata })` copies `metadata` onto the question's `UIMessage` (`ai-client/src/types.ts:418–440`) |
| Types `AnyTextAdapter`, `ChatMiddleware`, `UIMessage` | same | `ai/src/activities/chat/adapter.ts:237`, `middleware/types.ts:706`, `ai/src/types.ts:805` |

The spec's claims about `useChat` also hold. Its queue drops queued questions on Stop and on an error (`ai-client/src/types.ts:1123–1131`, `chat-client.ts:2907–2912`). Its storage adapters write the whole conversation as one record on every change (`ai-client/src/client-persistor.ts:39`, `109`).

### Findings

Each finding has a status. **Spec change (row 155 or 156)**: Peter amended SPEC-chat for it on 2026-10-27. **Build rule**: the code that a later task writes must follow it; the spec needs no change. **Note**: a fact for later tasks.

#### 1. Thinking signatures come back as a `reasoning` message

Status: spec change (rows 155 and 156).

The problem. Sonnet 5.5 always thinks. SPEC-chat first asked for `summary: false`, so the adapter sent `display: "omitted"`. Even then, Anthropic returns each thinking block's signature "for multi-turn continuity" (`@anthropic-ai/sdk/resources/messages/messages.d.ts:3946`; Anthropic's thinking docs, "Controlling thinking display"). The adapter streams it as `REASONING_ENCRYPTED_VALUE` (`ai-anthropic/src/adapters/text.ts:2045–2060`).

The browser's stream processor turns that event into a `thinking` part with empty text (`ai/src/activities/chat/stream/processor.ts:3035–3070`). With the next question, the client sends the part back as a `{ role: "reasoning", content: "", encryptedValue }` message (`ai/src/utilities/ag-ui-wire.ts:371–380`, `ai-client/src/connection-adapters.ts:1409`). SPEC-chat's request check passed only `user`, `assistant` and `tool`. So every question after the first answer would get 400 `INVALID_REQUEST`.

Facts for the choice. The engine stores the raw adapter events before `onChunk` (`index.ts:2094` runs before `2174`). So a wire rule that drops thinking events keeps the signatures that the read loop inside one turn needs. Anthropic needs thinking blocks back only inside a tool-use turn, and allows leaving out earlier turns' thinking (thinking docs, "Preserving thinking blocks"). A returned block stays valid only while the system prompt, the tools and the earlier messages stay unchanged (thinking docs, "Preserved thinking"). This chat changes them on purpose: the scope and audience lines, the 20-turn window and the ids-only reads.

The options.

| Option | Cost |
|---|---|
| A. The wire middleware drops every `REASONING_*` event, so the browser never holds a thinking part. The request check stays as approved. | One rule and one test. The model does not see its own thinking from earlier questions, which Anthropic allows. |
| B. The request check accepts `reasoning` messages, and the server drops them before `chat()`. | The browser saves the signatures and sends them back with every question, inside the 256 KB request cap. |
| C. The request check accepts `reasoning` messages and passes them to the model. | A visitor's edited message reaches the model as earlier thinking. The chat changes the prompt on purpose, so Anthropic rejects or drops old blocks. |

The decision. Peter chose A (row 155). The amendment first dropped every event whose type starts with `REASONING_`. Its review replaced that with an allowlist (the conductor, for Peter's end review): the wire middleware passes only the event types the browser needs and drops every other type (finding 9 checks the list against the source). The client also reads forms that a prefix rule could miss in a later version, such as `REASONING_MESSAGE_CHUNK` and `REASONING_MESSAGE` (`ai/src/activities/chat/stream/processor.ts:923`, `1046`). So the browser holds no thinking part and no signature, and sends nothing back. The request check stays as approved.

Row 155 first put a content-free `chat.thinking` event and a live step in place of the dropped events. Peter then chose to show the thinking summary, with guards (row 156), because the mockups leave space to show that the model is working:

- `handleChat()` asks for `reasoning: { level: "medium", summary: true }`, so the adapter sends `display: "summarized"`. Anthropic never returns the raw thinking: "what you see is never the raw chain of thought" (thinking docs, "How thinking works"). The thinking summary is the most there is.
- Peter allows the thinking summary in the browser because every approved source is public, and a source's `Not public` section names kinds of material only.
- The thinking summary streams as `REASONING_MESSAGE_CONTENT` (`ai-anthropic/src/adapters/text.ts:1975–1988`). The wire middleware sends it in the handler's own `CUSTOM` event `chat.thinking`: `{ active: true }` at a block's start, `{ delta: <text> }` for the thinking summary's text, and `{ active: false }` at its end. It never sends a signature.
- While thinking is active, a live answer step shows the thinking summary as plain text, never Markdown or HTML, under a label that marks it as the chat's working notes (the wording is a draft, row 153). After the answer, the thinking summary stays in the opened steps under that label. It is not counted in the folded steps line. Only the step's label is announced.
- The folded steps line shows when the turn read or has a thinking summary, so a visitor can always open the thinking summary. When the turn read nothing, the line's text is a wording draft for C26, for example "Thought it through".
- The browser saves the thinking summary as `answer.thinking`, outside the `UIMessage`, so it is never in a request. The evals' `mustNotContain` covers it, and the review file shows it. The question log stores no thinking text.

The review of the amendment added these guards (the conductor, for Peter's end review):

- The thinking summary never passes the marker middleware: an `[id]` or `<<…>>` in it stays plain text.
- The wire middleware sends at most `turnLimits.thinkingCharacters` (20,000) characters of thinking summary per turn; longer text ends with "…". A typical thinking summary is 1 to 3 KB.
- The wire middleware keeps its state per run, a new instance per request.
- The browser adds `delta` text to the view once per animation frame, and saves the thinking summary when thinking ends and when the message ends.
- A stream that ends while thinking is active closes the step, so no live spinner remains.
- The summarized display can delay the first answer text a little, and the step shows that wait. Billing is the same as with the thinking text omitted (thinking docs: "Either way the block is billed the same"), so the $0.90 reservation stays.

#### 2. A thrown run skips the `RUN_ERROR` rewrite

Status: spec change (row 155).

When the `chat()` stream throws, `toServerSentEventsResponse` writes its own `RUN_ERROR` with the error's own message (`ai/src/stream-to-response.ts:279–296`, `ai/src/activities/error-payload.ts:76`). That event never passes `onChunk`. The Anthropic adapter catches its own errors and sends `RUN_ERROR` (`ai-anthropic/src/adapters/text.ts:2341–2372`), but a throw from a hook or the engine still reaches the wire this way.

SPEC-chat now says: `handleChat()` wraps the `chat()` stream, and a throw becomes the handler's own `RUN_ERROR` with the new code `SERVER_ERROR`. The real error is logged on the server only, and an abort stays `stopped`. `wire.ts` exports one table of fixed messages per code and a `wireError(code)` builder, which the chunk middleware and every handler `RUN_ERROR` use.

The review added one shared function, `finishTurn()` in `src/chat/server/finish-turn.ts`. It writes the question-log entry and the `chat_turn` event exactly once per turn; the terminal hook and the wrapper both call it. SPEC-deploy's error share now counts `SERVER_ERROR` as an error.

#### 3. A guard runs after every `onBeforeToolCall` transform, not after a skip

Status: spec change (row 155), wording only.

A `skip` or `abort` decision from an `onBeforeToolCall` ends the call before the input check and the guard (`ai/src/activities/chat/tools/tool-calls.ts:1257`). The tool does not run then, so no read happens, and the read budget stays right. SPEC-chat now says that every read that runs has passed the guard.

With parallel tool runs (the default), the guards still run one call at a time, in call order (`tool-calls.ts:1328`, inside the preparation loop).

#### 4. Error codes

Status: build rule.

The adapter's code for the output cap is `max_tokens` in lower case; `MAX_TOKENS` is the handler's own code, which the wire middleware maps. An Anthropic API error's code is its HTTP status, or `context_overflow` for a prompt that is too long (`ai-anthropic/src/adapters/text.ts:2381–2385`, `ai/src/activities/error-payload.ts:41`).

#### 5. The preview's fake model

Status: build rule.

One `fakeText()` adapter keeps one queue, and each model call takes the next answer (`ai/src/testing/fake-text.ts:182–186`). The route therefore makes a new fake for each request, or queues a function step that picks the scripted turn from the request's question text.

#### 6. Thinking events from the adapter

Status: note. Finding 1's decision drops these events from the wire.

For each thinking block the adapter sends `REASONING_START` and `REASONING_MESSAGE_START`, then the text as `REASONING_MESSAGE_CONTENT`, then the signature as `REASONING_ENCRYPTED_VALUE`, then the end events (`ai-anthropic/src/adapters/text.ts:1874–1893`, `1975–1988`, `2045–2070`). With `display: "omitted"` the text is empty; with `"summarized"` it is the thinking summary. The signature is encrypted thinking, not text.

#### 7. The chat's browser code

Status: note for C18, C23 and S30.

`@tanstack/ai-react` with `@tanstack/markdown/react` is about 63 KB gzip (the performance review). C1 measured 66,933 bytes: `bun build --target browser --minify` of `useChat`, `fetchServerSentEvents` and `Markdown`, with React left out, then `gzip -9`. That is a third of SPEC-site's budget of 200 KB compressed for the JavaScript that `/` loads before any interaction (SPEC-site, Acceptance). So the chat's browser code loads on demand, not with the first view.

#### 8. React in the lockfile

Status: note for S1.

`package.json` lists only the four packages. `bun install` put `react` 19.3.1 and `@types/react` 19.3.0 in `bun.lock` as peers of `@tanstack/ai-react`. S1 declares them in `package.json` at those versions.

#### 9. The event allowlist, checked against the source

Status: spec change (the review of rows 155 and 156; the conductor, for Peter's end review).

AG-UI 1.0.0 defines 31 event types (`@ag-ui/core/dist/version-DEKfpZNa.d.ts:5–37`). Two lists from the installed source decide the allowlist in SPEC-chat (The request, "Events on the wire"):

- **Emitted.** `@tanstack/ai` 1.0.0's engine and `@tanstack/ai-anthropic`'s adapter can emit 22 types on a chat stream. A grep for every `type:` constant outside the tests finds them; `ai/src/utilities/spec-event-keys.ts` names the other types only as a key map. With the chat's setup, which has no interrupts, `state`, subagents, `outputSchema`, sandbox or MCP, the stream carries 17 of the 22.
- **Consumed.** `@tanstack/ai-client` uses the `StreamProcessor` of `@tanstack/ai/client` (`ai-client/src/chat-client.ts:1–14`, `451`). It consumes 26 types: 23 in its dispatch switch (`ai/src/activities/chat/stream/processor.ts:705–842`) and the three `*_CHUNK` forms, which it expands (lines 857–1000). Its default branch ignores the other 5 (line 840).

The allowlist holds the 11 types that the chat's stream carries and the browser needs. Every other type is dropped.

| Type | Emitted (`ai/src/…` or the adapter) | Processor reads (`processor.ts`) | On the wire | Why it is safe to drop |
|---|---|---|---|---|
| `RUN_STARTED` | adapter `text.ts:1738`; `activities/chat/index.ts:3131` | 777 | passes | |
| `RUN_FINISHED` | adapter `text.ts:2201`; `index.ts:1739` | 753 | passes | |
| `RUN_ERROR` | adapter `text.ts:752`, `2266`; `index.ts:3909`; `stream-to-response.ts:166` | 759 | passes, as `wireError(code)` | |
| `TEXT_MESSAGE_START` | adapter `text.ts:1957`; `index.ts:7178` | 717 | passes | |
| `TEXT_MESSAGE_CONTENT` | adapter `text.ts:1968` | 723 | passes | |
| `TEXT_MESSAGE_END` | adapter `text.ts:2170` | 729 | passes | |
| `TOOL_CALL_START` | adapter `text.ts:1853`; `index.ts:4221` | 735 | passes | |
| `TOOL_CALL_ARGS` | adapter `text.ts:2028`; `index.ts:4229` | 741 | passes | |
| `TOOL_CALL_END` | adapter `text.ts:1863`; `index.ts:4236` | 747 | passes | |
| `TOOL_CALL_RESULT` | `index.ts:2512`, `4243` | 821 | passes, read results as ids | |
| `CUSTOM` | `index.ts:6045` (`ctx.emitCustomEvent`), `2162` | 771 | passes, the chat's own `chat.<name>` events only | The engine's own names need features the chat does not use: `structured-output.*` (`outputSchema`), `sandbox.file*` (`index.ts:1410–1419`, a sandbox), `ui-resource` (`index.ts:5906`, MCP apps) |
| `REASONING_START` | adapter `text.ts:1882` | 783, no action | dropped | Row 155: the client would build a thinking part from it; `chat.thinking` replaces it |
| `REASONING_MESSAGE_START` | adapter `text.ts:1888` | 789 | dropped | Row 155, as above |
| `REASONING_MESSAGE_CONTENT` | adapter `text.ts:1983` | 809 | dropped | Row 155; its text goes out as `chat.thinking` `delta` |
| `REASONING_MESSAGE_END` | adapter `text.ts:1922` | 784, no action | dropped | Row 155, as above |
| `REASONING_END` | adapter `text.ts:1928` | 785, no action | dropped | Row 155, as above |
| `REASONING_ENCRYPTED_VALUE` | adapter `text.ts:1914`, `2054` | 815 | dropped | It is the signature; row 155 keeps it off the wire |
| `MESSAGES_SNAPSHOT` | `index.ts:3816`, sent only at an interrupt (`3974`) | 765 | dropped | The chat has no interrupt. It would carry the full tool messages, read text included |
| `STATE_SNAPSHOT` | `index.ts:3977`, only at an interrupt with `chat({ state })` | 840, ignored | dropped | The chat has neither |
| `SUBAGENT_STARTED` | `activities/chat/agents/spawn.ts:764` | 705 | dropped | Only with `chat({ subagents })`; the chat has none |
| `SUBAGENT_FINISHED` | `spawn.ts:705` | 709 | dropped | As above |
| `SUBAGENT_ERROR` | `spawn.ts:319` | 713 | dropped | As above |
| `ACTIVITY_SNAPSHOT` | none; the engine only passes on an adapter's (`index.ts:2294`), and the Anthropic adapter sends none | 827 | dropped | Never on this stream; it would build activity parts that the chat does not show |
| `ACTIVITY_DELTA` | none, as above | 833 | dropped | As above |
| `TEXT_MESSAGE_CHUNK` | none | 858, expanded | dropped | Never emitted. If a later version sent text this way, the seam-1 tests and C12's round trip through the real processor would fail on the missing text: the rule fails closed, it never leaks |
| `TOOL_CALL_CHUNK` | none | 887, expanded | dropped | As above |
| `REASONING_MESSAGE_CHUNK` | none | 923, expanded | dropped | As above, and row 155 keeps every thinking event off the wire |
| `STEP_STARTED` | none | 840, ignored | dropped | Never emitted, and the processor ignores it |
| `STEP_FINISHED` | none | 840, ignored | dropped | As above |
| `STATE_DELTA` | none | 840, ignored | dropped | As above |
| `RAW` | none | 840, ignored | dropped | As above |

The client also reads `RUN_STARTED`, `RUN_FINISHED`, `RUN_ERROR`, `REASONING_ENCRYPTED_VALUE` and `SUBAGENT_*` itself, outside the processor (`ai-client/src/chat-client.ts:369`, `1398`; `connection-adapters.ts`). That adds no type the allowlist needs.
