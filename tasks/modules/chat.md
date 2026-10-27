# Chat tasks

Spec: [SPEC-chat](../../spec/SPEC-chat.md) (approved, row 139), with the contracts of SPEC-knowledge, SPEC-site and SPEC-deploy. The order is in [todo.md](../todo.md); read these conventions and your task's body only.

## Conventions

- **Size** follows the planning skill's table: S is 1 or 2 files, M is 3 to 5. C1 counts its lockfile as generated; C39 is M because its fixes can touch the UI files.
- **Seams.** Seam 1 is `handleChat()` in `src/chat/server/__tests__/handle-chat.test.ts`, with `fakeText()`, knowledge built from fixtures (one fixture source has `Not public` text) and the in-memory log, budget and telemetry. Seam 2 is SPEC-site's browser test, `src/site/__tests__/browser.test.ts`, which builds into the seam-1 folder and serves it with `bun run preview --dir <folder>`. The evals run outside `bun test`. No other seam (row 83).
- **Before every commit** (AGENTS.md): `bun run build`, `bun run build:site` (once it exists) and `bun test`. Each task's Verify line names the focused commands.
- **Pushes.** Every file under `src/`, `evals/`, `scripts/` and `vite.config.ts` is a site file, so each push to `main` is a release, under Peter's standing approval (row 151; SPEC-deploy; the `release` skill).
- **Library skills.** A task that writes TanStack AI or TanStack DB code loads that package's skills first (`bun run intent load …`); a task that writes UI loads `@acmelabs/design-system#choose-and-compose`, `#react-integration` and `#forms-and-accessibility`, and asks the `acme-design-system` MCP server for each part with version `0.3.2` and framework `react` (AGENTS.md "Libraries"; SPEC-chat Code Style).
- **Design-system parts checked on 2026-10-27** (MCP, 0.3.2): `acme-textarea` (`auto-resize`, no slots), `acme-toggle-tip` (slot `trigger`; parts `content`, `close`), `acme-group`, `acme-toggle-button`, `acme-select`, `acme-alert`, `acme-alert-dialog`, `acme-icon-button`, `acme-show-more`, `acme-relative-time`, `acme-copy-button`, `acme-card`, `acme-item`, `acme-list`, `acme-spinner`, `acme-progress` and `acme-markdown` all exist.
- **Main's decisions of 2026-10-27, which main writes into SPEC-chat:** the handler sets the short prompt cache itself (no `ChatDeps` field); `ChatDeps` gains `origins: string[]`, which the route computes from `VERCEL_ENV` and `VERCEL_URL` (an empty list means the request's own origin); the eval case gains optional `history`, `scope` and `audience`.
- **Workspace members.** The site's `Workspace` exists from S14, and each member whose behavior a later site task adds is a no-op until then. A chat task checks that it calls `openCitation()`, `setCited()`, `openResume()`, `setConversationActive()`, `answerFinished()` or `reset()`; S32 to S36 check the effect.
- **Answered for the plan:** `acme-markdown`'s prose rules cannot be reused as a stylesheet in 0.3.2 (C23 copies them onto the tokens and names the gap). The deadline test can use Bun 1.4.2's fake timers (checked).

## Tasks

### C1: Install the chat's packages and check SPEC-chat's TanStack AI names

Delivers: the three TanStack AI 1.0.0 packages and `@tanstack/markdown` are installed at exact versions, and every TanStack AI name SPEC-chat uses has a checked verdict before any chat code is written.
Blocked by: none
Acceptance:
- `package.json` pins `@tanstack/ai`, `@tanstack/ai-react` and `@tanstack/ai-anthropic` at 1.0.0 and `@tanstack/markdown` at 0.0.13 as a direct dependency; `bun install` and `bun test` pass (Tech Stack; "Approving this spec approves adding these dependencies").
- Each name in SPEC-chat is checked against the package's skills (`bun run intent load @tanstack/ai#…`) or its published source: `chat()`, `chatParamsFromRequestBody()`, `toServerSentEventsResponse`, `fakeText()`, `anthropicText()`, `createAnthropicChat()`, `createAnthropicChatWithClient()`, the middleware hooks (`onGuardToolCall`, `onBeforeToolCall`, `onConfig`, `onChunk`, `onUsage`, the terminal hook with `ctx.defer()`), `agentLoopStrategy: maxIterations()`, `toolChoice: "none"`, `reasoning: { level, summary }`, `modelOptions.max_tokens`, `promptCache`, `wireContent`, the `RUN_ERROR`, `CUSTOM` and `TOOL_CALL_RESULT` events, and `useChat`'s `initialMessages`, `threadId` and `sendMessage` `body` (Code Style: "The plan loads the TanStack AI skills … and checks every API name").
- The verdicts are in research 07, one line each with its source; a name that differs goes to Peter as a SPEC-chat amendment before C3 starts.
Verify: `bun install`; `bun run intent list`; `bun test`; read the new section of research 07.
Files: `package.json`, `bun.lock`, `docs/research/07-tanstack-ai-hosting-model.md`
Size: S
Needs Peter: no, unless a name differs from SPEC-chat; then he approves the spec amendment.

### C2: The question log, budget and telemetry contracts, with the contract suite

Delivers: the three interfaces SPEC-deploy implements exist with in-memory versions, and the QuestionLog contract suite runs at seam 1, so the deploy module's ops work can start.
Blocked by: none
Acceptance:
- `src/chat/server/__tests__/question-log-contract.ts` exports the suite, and seam 1 runs it against the in-memory log: an appended entry comes back from `list(1)`; on 2026-10-27, `list(7)` returns the entries dated 2026-10-21 to 2026-10-27, newest first, and none dated 2026-10-20; an empty log returns no entries (Question log, "The day window"; Testing Strategy, "The QuestionLog contract").
- `src/chat/server/question-log.ts` exports `QuestionLog`, `QuestionLogEntry`, `Budget` and `Telemetry`, and `src/chat/server/telemetry.ts` exports `ChatTurnEvent`, as the spec writes them, with no IP address, `threadId`, scope or audience field; the in-memory budget allows, or refuses with the code it was given, and the in-memory telemetry keeps each event (Question log; Turn telemetry; Evals).
- Nothing under `src/chat/` imports from `src/ops/` or `src/deploy/` ("so the chat imports nothing from the deploy module").
Verify: `bun test src/chat`; `grep -r "src/ops\|src/deploy" src/chat` prints nothing.
Files: `src/chat/server/question-log.ts`, `src/chat/server/telemetry.ts`, `src/chat/server/__tests__/question-log-contract.ts`, `src/chat/server/__tests__/handle-chat.test.ts`
Size: M
Needs Peter: no

### C3: One turn through `handleChat()`: a resume citation kept and one log entry

Delivers: the walking skeleton of a turn: `handleChat(request, deps)` streams a fake-model answer as server-sent events, keeps a resume citation, and writes one question-log entry.
Blocked by: C1, C2, K3 (`buildKnowledge()` with the core, the catalog and the sources, `renderCore()`, and the id rules in `src/knowledge/ids.ts`)
Acceptance:
- An answer with no read keeps a resume citation in the streamed text, and the `chat.citations` `CUSTOM` event lists it with 0 removed (Testing Strategy, "Citations"; Markers).
- The turn writes one `answered` entry with the UTC day, the question and the kept citations, and no `threadId`, after the run ends, from the terminal hook with `ctx.defer()` (Question log).
- The model request holds the system prompt with `renderCore(knowledge)` and the last turns (One turn, step 4); `ChatDeps` and `handleChat()` have the signatures in Code Style.
Verify: `bun test src/chat`
Files: `src/chat/server/handle-chat.ts`, `src/chat/server/prompt.ts`, `src/chat/server/markers.ts`, `src/chat/server/__tests__/handle-chat.test.ts`
Size: M
Needs Peter: no (the prompt's wording is approved in C15)

### C4: Request checks with the `ChatError` shape and `turnLimits`

Delivers: a malformed, oversized or cross-site request gets one JSON error shape and never reaches the model.
Blocked by: C3
Acceptance:
- The server reads the request in the spec's order: a body over 256 KB gets 413 `REQUEST_TOO_LARGE`; bad JSON, a body `chatParamsFromRequestBody()` rejects, a `system` message and a user image part each get 400 `INVALID_REQUEST`; a question of 10,001 characters gets 413 `QUESTION_TOO_LONG`; each is the `ChatError` JSON, never a plain-text body; `forwardedProps` without its three keys passes `ChatProps` (The request; Testing Strategy, "Request checks").
- `Origin: https://example.com` gets 403 `FORBIDDEN_ORIGIN`. The handler allows the origins in `deps.origins` (`ChatDeps` gains `origins: string[]`; main's decision, written into SPEC-chat), and an empty list allows only the request's own origin; no `Origin` header passes (The request, "Origin"). C17's route fills `origins`.
- None of these calls the model or writes the log, and a body that carries its own `tools` and `context` still gives the model the handler's tools only; `turnLimits` holds the spec's values (Limits).
Verify: `bun test src/chat`
Files: `src/chat/server/handle-chat.ts`, `src/chat/server/props.ts`, `src/chat/server/limits.ts`, `src/chat/server/__tests__/handle-chat.test.ts`
Size: M
Needs Peter: no

### C5: The read tool: passages read on the server, ids only on the wire

Delivers: the model can read approved sources through `read_sources`, cite what it read, and no read text reaches the browser.
Blocked by: C3, K7 and K8 (`readPassages()` with `readLimits`)
Acceptance:
- A read then an answer keeps a citation to a read passage and removes one to an unread passage; `chat.citations` reports 1 removed (Testing Strategy, "Citations").
- No streamed event holds passage text or the fixture's `Not public` text; each `read_sources` `TOOL_CALL_RESULT` holds `{ read, unknown, skipped }` only, and the model's next call still gets the full read text (Read results on the wire).
- A call with 21 ids, or with an id of 65 characters, gets a tool error from the input schema, and the run goes on (Tools; "Read limits").
Verify: `bun test src/chat`
Files: `src/chat/server/tools.ts`, `src/chat/server/wire.ts`, `src/chat/server/markers.ts`, `src/chat/server/handle-chat.ts`, `src/chat/server/__tests__/handle-chat.test.ts`
Size: M
Needs Peter: no

### C6: The read budget and the last call

Delivers: code, not the prompt, stops the fourth read and makes the last model call answer, with the cached tool list unchanged.
Blocked by: C5
Acceptance:
- Four scripted reads: the fourth is skipped with an error result, every model call in the turn has the same tools, and the call after the third read has `toolChoice: "none"` (Limits, "Reads"; Testing Strategy, "The read budget").
- A read whose input fails the schema does not count, and another middleware's `onBeforeToolCall` that transforms the arguments cannot skip the budget (Testing Strategy, "The read budget").
- Five scripted model calls that each call a tool: the sixth has `toolChoice: "none"`, and the turn ends with an answer (`agentLoopStrategy: maxIterations(6)`; "The last call").
Verify: `bun test src/chat`
Files: `src/chat/server/limits.ts`, `src/chat/server/handle-chat.ts`, `src/chat/server/__tests__/handle-chat.test.ts`
Size: M
Needs Peter: no

### C7: The "Ask about this" read and request line

Delivers: a question asked about a passage reads that passage first, so the answer can cite it; one asked about a resume entry names it.
Blocked by: C6
Acceptance:
- An `about` passage or source id is read with `readPassages(knowledge, [about])` after `budget.reserve()` and before the first model call; the stream starts with that `read_sources` call (`topic` is the source's title) and its id-only result; the passage can be cited, and only 2 more reads are allowed (The request, "About"; Testing Strategy, "About").
- An `about` that is a resume entry id adds a request line naming the entry, with no read (The request, "About").
Verify: `bun test src/chat`
Files: `src/chat/server/handle-chat.ts`, `src/chat/server/prompt.ts`, `src/chat/server/__tests__/handle-chat.test.ts`
Size: M
Needs Peter: no

### C8: Markers: refusals, follow-up questions and the citation forms

Delivers: refusal and follow-up markers never reach the answer text, and only real citation forms are checked.
Blocked by: C5
Acceptance:
- Refusal and follow-up markers leave the text and arrive as `CUSTOM` events; the log has the refusal outcome; a third follow-up question is dropped, and one of 120 characters never reaches the text (Markers; Testing Strategy, "Markers").
- `[1]`, `[x]`, `items[0]`, and a citation form inside inline code, fenced code or link text pass unchanged; text from `[` is held at most 120 characters (Markers, "Citation forms", "Code and links", "Holding").
- An unknown `<<…>>` and a whole-source marker are removed and counted; text held at the end of a message is flushed as text (Markers).
Verify: `bun test src/chat`
Files: `src/chat/server/markers.ts`, `src/chat/server/__tests__/handle-chat.test.ts`
Size: S
Needs Peter: no

### C9: The open tools: `open_resume` and `open_source`

Delivers: the model can open the resume, or a passage the conversation cites, and nothing else.
Blocked by: C8
Acceptance:
- `open_source` with an id the conversation never cites returns an error; an id that an earlier answer's text cites with a kept marker, or that this turn read, returns `{ opened: true }` (Tools; Testing Strategy, "`open_source`").
- `open_resume` returns `{ opened: true }`; neither tool writes anything (Tools).
Verify: `bun test src/chat`
Files: `src/chat/server/tools.ts`, `src/chat/server/__tests__/handle-chat.test.ts`
Size: S
Needs Peter: no

### C10: The conversation sent: 20 turns, 40,000 characters, earlier reads as ids

Delivers: a long or edited conversation cannot grow the model request or smuggle read text back to the model.
Blocked by: C5
Acceptance:
- Earlier turns over 40,000 characters: the oldest are dropped first; twenty-five turns of history: the model receives 20 (Limits, "Conversation sent"; Testing Strategy, "History").
- Earlier reads reach the model as ids only, also when the request carries edited read text (The request, "Trust").
Verify: `bun test src/chat`
Files: `src/chat/server/handle-chat.ts`, `src/chat/server/limits.ts`, `src/chat/server/__tests__/handle-chat.test.ts`
Size: M
Needs Peter: no

### C11: The limit stream, stream errors, model errors and Stop

Delivers: a refused or failed turn ends as a stream the browser can show, with no provider detail in it.
Blocked by: C3
Acceptance:
- A `budget` that refuses gives an HTTP 200 stream with one `RUN_ERROR` event and its code (`DAILY_LIMIT` or `SPEND_LIMIT`), no model call and no log entry (The request, "Limits"; Testing Strategy, "Limits").
- Every `RUN_ERROR` on the wire holds only its code and the fixed message for it: no `rawEvent`, `metadata`, `usage` or Anthropic error body (Stream errors).
- A model error gives `RUN_ERROR` and an `error` entry; an aborted request gives a `stopped` entry (Testing Strategy, "Endings").
Verify: `bun test src/chat`
Files: `src/chat/server/handle-chat.ts`, `src/chat/server/wire.ts`, `src/chat/server/__tests__/handle-chat.test.ts`
Size: M
Needs Peter: no

### C12: The stub Anthropic client: Anthropic's limit, `max_tokens` and the thinking settings

Delivers: the turns `fakeText()` cannot script are tested through `createAnthropicChatWithClient()` and a stub Messages client.
Blocked by: C11
Acceptance:
- The stub's spend-limit errors, with both documented bodies (HTTP 400 `invalid_request_error` starting "You have reached your specified"; HTTP 429 `error.details.error_code` `enforced_spend_limit_reached`), built with the SDK's real error class, end the stream with `SPEND_LIMIT` and write a `limit` entry; the handler reads the status and body, not the message text (The request, "Limits"; SPEC-deploy, "The monthly limit").
- The stub's `max_tokens` stop ends the stream with `RUN_ERROR` `MAX_TOKENS` and writes an `error` entry; partial text is not kept (How a turn ends; Testing Strategy, "Endings").
- The stub sees adaptive thinking with effort `medium`, the thinking text omitted, `max_tokens` 8,000 and the short prompt cache on every model call; `handleChat()` sets the cache itself, with no `ChatDeps` field (Limits, "Thinking"; Testing Strategy, "Thinking"; main's decision, written into SPEC-chat).
Verify: `bun test src/chat`
Files: `src/chat/server/__tests__/stub-anthropic.ts`, `src/chat/server/handle-chat.ts`, `src/chat/server/__tests__/handle-chat.test.ts`
Size: M
Needs Peter: no

### C13: The 120-second deadline

Delivers: a stuck model call ends with an error event, so a cut answer never looks finished.
Blocked by: C12
Acceptance:
- A stub call that never ends: at 120 s (Bun's fake timers) the stream ends with the handler's own `RUN_ERROR` `DEADLINE` before it closes, and the entry is `error` (Limits, "Deadline"; Testing Strategy, "Endings").
Verify: `bun test src/chat`
Files: `src/chat/server/limits.ts`, `src/chat/server/handle-chat.ts`, `src/chat/server/__tests__/handle-chat.test.ts`
Size: M
Needs Peter: no

### C14: Turn telemetry: summed usage and one `chat_turn` event per turn

Delivers: Peter can see each turn's outcome, tokens and duration without visitor text, and the daily cap gets true counts.
Blocked by: C4, C12
Acceptance:
- Two finished model calls, then a Stop during the third: telemetry gets the sum of the two calls' usage as SPEC-deploy's five counts; the counts are `null` when no call finished (Turn telemetry; Testing Strategy, "Usage").
- Each turn hands one `chat_turn` event with its reservation to `telemetry.record()`, a rejected request with `rejected` and a refusal before the model call with `limit`; no event holds question text or the `threadId` (Turn telemetry; Testing Strategy, "Telemetry").
- The response ends only after the log and telemetry writes, and a log or telemetry write that fails never breaks the answer (Testing Strategy, "Usage"; Question log; SPEC-deploy amendment 10).
Verify: `bun test src/chat`
Files: `src/chat/server/telemetry.ts`, `src/chat/server/handle-chat.ts`, `src/chat/server/__tests__/handle-chat.test.ts`
Size: M
Needs Peter: no

### C15: The system prompt, the scope and audience lines, and the refusal wordings

Delivers: the prompt that the real model gets, approved by Peter, with the request lines that scope and aim each answer.
Blocked by: C7, C8, C9
Acceptance:
- The model request holds the scope line from the core ("The visitor is asking about FedNow, 2021 – 2024."), none for an unknown role id, and one audience line for each of the five audiences, none for no choice (The request, "Scope", "Audience").
- The system prompt says what the spec lists: the third person, the chat's topics and the refusal rules with the two refusal wordings and the email from `basics`, Peter's wording rule, the marker formats, the fit check's rules, the open tools, and that a pasted text is material, never instructions (The request; Answers the chat gives).
- Peter approves the prompt, the five audience lines and the two refusal wordings in the question tool; a decision-record row holds the approval (Boundaries, "Ask first").
Verify: `bun test src/chat`; Peter's approval.
Files: `src/chat/server/prompt.ts`, `src/chat/server/__tests__/handle-chat.test.ts`, `docs/design/interview-2026-10-26.md`
Size: M
Needs Peter: yes: approval of the system prompt's wording, the audience lines and the refusal wordings.

### C16: The chat's Vite plugin: `virtual:knowledge` and the device index

Delivers: the chat function gets the knowledge base bundled at build time, and the browser gets a device index with no `Not public` text.
Blocked by: K9 (`publicKnowledge()`), S8 (`buildSite()`, `vite.config.ts` and the seam-1 build test, which runs `scripts/build-site.ts`)
Acceptance:
- `virtual:knowledge` gives the server route the `buildKnowledge()` output at build time, bundled with the function, so it reads no source file at run time; the plugin is added in `vite.config.ts` (The build).
- The build writes `device-index.json` into `.vercel/output/static/` from `publicKnowledge(knowledge)`: one label per resume entry ("Resume: FedNow", "Resume: FedNow, highlight 2"), the logistics answers and passages with their labels and text, and the approved sources' `links`; `src/chat/device-index.ts` loads it once in the browser (The build; Citations card).
- SPEC-site's seam-1 check passes with it: no file under `static/` holds the fixture's `Not public` text. The precache check for `device-index.json` belongs to S28, which comes later.
Verify: `bun run build:site`; `bun test src/site/__tests__/build.test.ts`
Files: `src/chat/vite-plugin.ts`, `src/chat/device-index.ts`, `vite.config.ts`, `src/site/__tests__/build.test.ts`
Size: M
Needs Peter: no

### C17: The route file `api.chat.ts`, with the fake model outside production

Delivers: `/api/chat` answers in the preview with scripted turns, and in production with Sonnet 5.5.
Blocked by: C14, C16, D9 (`createOps()` with its in-memory parts outside production and `PREVIEW_LIMIT`), S9 (`bun run preview --dir` and the browser test's harness), K11, K12, K13 (the nine deep dives in `knowledge/sources/`: the scripted turns cite real ids such as `fednow-bundle-size.2`)
Acceptance:
- When `VERCEL_ENV` is not `production`, the route uses `fakeText()` with the scripted turns of `src/chat/server/__tests__/fixtures.ts`, picked by question text, whatever variables are set (an `ANTHROPIC_API_KEY` included); in production, `anthropicText("claude-sonnet-5-5")` (The route file; Tech Stack).
- `ChatDeps` come from `virtual:knowledge`, SPEC-deploy's `createOps(process.env)`, the real clock and `origins`, which the route computes from `VERCEL_ENV` and `VERCEL_URL`: in production `https://peterkloss.dev` and `https://$VERCEL_URL`, elsewhere an empty list, which means the request's own origin (The route file; main's decision). The check through `bun run preview --dir` (a `POST /api/chat` from the page streams a scripted answer) is S31's, right after this task.
- `bun run dev` answers a scripted question with the fake model (Commands).
Verify: `bun run build:site`; `bun test`; manual: `bun run dev`, ask a scripted question.
Files: `src/site/routes/api.chat.ts`, `src/chat/server/__tests__/fixtures.ts`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C18: A suggested question sends once, and its answer streams into the chat column

Delivers: the first end-to-end path a visitor sees: select a suggested question, see it and its answer in the conversation.
Blocked by: C17, S31 (the preview answers `/api/chat`), S14 (the workspace contract, `useWorkspace()`), S15 (the workspace route with the first view's suggested questions and `suggestedQuestion`)
Acceptance:
- Selecting a suggested question sends it once, with the current scope and audience, then calls `clearSuggestedQuestion()`; the question shows on the right and the answer on the left, at the column's full width, 20 px apart with a 28 px action row each (Suggested questions; Messages; Testing Strategy, seam 2 bullet 1).
- The first send calls `setConversationActive(true)`; each finished answer calls `answerFinished()` once (Workspace effects).
- Each request carries the conversation's `threadId` (a UUID) and the question's `scope`, `audience` and `about` in `forwardedProps`, through `sendMessage`'s `body` (The request).
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/site/routes/index.tsx`, `src/chat/ui/ChatColumn.tsx`, `src/chat/ui/Messages.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C19: The chat input: send, Enter and Shift+Enter, focus

Delivers: a visitor can type and send a question from the input as drawn.
Blocked by: C18
Acceptance:
- A one-line `acme-textarea` with `auto-resize` in a plain wrapper that holds the send button as an end add-on, named in the code as a design-system gap; the placeholder is "Ask about a project, a role or a skill", then "Ask a follow-up" (Chat input).
- Empty: Send is off; Ready: Enter sends, Shift+Enter adds a line (the state table).
- After sending, focus stays in the input, and Tab reaches the input (Accessibility).
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/ui/ChatInput.tsx`, `src/chat/ui/ChatColumn.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C20: The saved conversation: one row per message, restored before the first render

Delivers: a returning visitor sees the conversation where they left it, with no first view before it.
Blocked by: C19, S12 (the head script with `pk-conversation`), S14 (`setConversationActive()`, a no-op until S34), S21 (TanStack DB installed, `@tanstack/react-db` 0.5.12)
Acceptance:
- The chat opens `peterkloss-chat` once with `createIndexedDB({ name: "peterkloss-chat", version: 1, stores: ["messages", "queue", "session"] })` and one `indexedDBCollectionOptions` collection per store; the sending tab writes a message's row when it is added and again when it ends, never the whole conversation, and `useChat` runs without its own persistence (Saved conversation). The DB names are checked against the package's skills first.
- A reload restores the conversation at the latest answer with no notice: the collections are read before the first render and passed as `initialMessages` and `threadId`; the restore calls `setConversationActive(true)`, or `setConversationActive(false)` with nothing saved (A returning visitor; Testing Strategy, seam 2). S34 checks the effect: the first view never shows, layout shift stays under 0.1, and with nothing saved the first view shows.
- A `session` row with an unknown `version` clears the chat's stores, and blocked storage works as a first visit with the conversation in memory (Saved conversation, "Version").
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/saved-conversation.ts`, `src/chat/ui/ChatColumn.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C21: The scope and About chips; each question keeps its own request

Delivers: a visitor can ask about a role from the timeline or a line of the resume or a source, and each question is asked the same way again later.
Blocked by: C20, S14 (the career timeline's `scope` with `label` and `years`), S18 and S20 ("Ask about this", `askRequest`)
Acceptance:
- With a scope, the chip inside the input reads "Asking about FedNow, 2021 – 2024 ×" from `workspace.scope`, the placeholder is "Ask about FedNow", and × calls `setScope(null)` (Chat input; row 137).
- `askRequest` puts the chip "About: Resume, FedNow, highlight 2" (a device-index label) in the input, clears the request and focuses the input; with an empty input, Enter or Send asks "Tell me more about this."; × removes the chip, and it clears after sending (Ask about this; the state table, "Empty").
- Each question's message metadata, and so its saved row, keeps its `about`, scope and audience (Saved conversation, "Each question's request").
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/ui/ChatInput.tsx`, `src/chat/ui/ChatColumn.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C22: "Answers for": the popover on wide columns, the select on phones, and the anonymous-log line

Delivers: a visitor chooses who the answers are for, and sees that questions are kept anonymously.
Blocked by: C21
Acceptance:
- With the column 520 px or wider, a compact trigger ("Answers for: Anyone ▾") opens `acme-toggle-tip` with the line of context, the five audiences as an attached `acme-group` of `acme-toggle-button`s (`role="group"`, named "Answers for"; "Product" named "Product manager"; pressing the pressed one clears it) and the line for the chosen audience; the `::part(content)` width and the hidden `::part(close)` are set through a plain wrapper and named as design-system gaps (Answers for).
- Escape closes the popover and returns focus to the trigger; a click outside closes it; at 390 × 844 the control is `acme-select` labelled "Answers for"; both write the session row's audience, which survives a reload and shows in the popover after a resize (Answers for; Testing Strategy, seam 2).
- The trigger and "Questions are kept anonymously to improve answers." share one row at 1440 × 900; on phones the line goes under the control (Chat input; Testing Strategy, seam 2).
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/ui/AudienceChoice.tsx`, `src/chat/ui/ChatInput.tsx`, `src/chat/saved-conversation.ts`, `src/chat/ui/ChatColumn.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: yes: approval of the popover's wording and of the anonymous-log line's wording (SPEC-chat: "Peter approves the popover's wording" and, for the line, "Peter approves the wording"; decision 0020). The decision record holds no approval of either text: row 84 approved the line's place under "Answers for", and row 139 the boards that draw both. Peter may count row 139 as the approval.

### C23: Answers render as untrusted Markdown, with the link and image rules

Delivers: answer text reads as formatted prose, and a pasted posting cannot make an answer load an image or link to a page Peter did not choose.
Blocked by: C18, C16
Acceptance:
- `AnswerText` renders through `@tanstack/markdown/react` with `allowHtml` never set: raw HTML shows as text, and `img` renders its alt text only (Rendering answers; Testing Strategy, seam 2).
- `a` renders a link only for `https://peterkloss.dev/…` (same tab), `https://github.com/loriensleafs/…`, `https://github.com/acmelabs-15/…`, `mailto:` Peter's email and the approved sources' `links` from the device index (new tab, `rel="noopener noreferrer"`); any other link renders as its text (Rendering answers).
- The prose uses the design system's tokens. The check the spec asks for: `acme-markdown`'s `[data-acme-markdown-prose]` rules are not exported in 0.3.2 (its `./styles/*` holds only `tokens.css` and `dashboard.css`; the rules are adopted only while an `acme-markdown` is on the page), so the chat's stylesheet carries the same rules on the tokens and names the gap (Rendering answers; Open Questions).
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/ui/Answer.tsx`, `src/chat/ui/AnswerText.tsx`, `src/chat/ui/answer-markdown.ts`, `src/chat/server/__tests__/fixtures.ts`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C24: Kept citations as numbered buttons, numbered per answer

Delivers: each fact in an answer carries a citation button that opens where it came from.
Blocked by: C23, S14 (`openCitation()` and `setCited()`, no-ops until S32), S18 (the document panel's source tab)
Acceptance:
- Each kept `[id]` becomes a `#cite:<id>` link node; the `a` component draws a numbered citation button only for an id in this answer's kept citations, numbered by its position from 1; a `#cite:` link to any other id renders as its text; a second answer starts again at 1 (Rendering answers; row 133; Testing Strategy, seam 2).
- Each button's name says what it opens: "Citation 1: The FedNow bundle cut, What Peter did" (Accessibility).
- Selecting citation n calls `openCitation(id, n)`, and the chat calls `setCited(keptIds)` after each answer and again on restore (Workspace effects; Testing Strategy, seam 2 bullets 1, 2 and 10). S32 checks the effect: citation 1 opens the source tab with the passage marked, and the cited roles light up on the timeline.
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/ui/answer-markdown.ts`, `src/chat/ui/AnswerText.tsx`, `src/chat/ui/ChatColumn.tsx`, `src/chat/server/__tests__/fixtures.ts`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C25: The citations card

Delivers: under each answer, a card lists that answer's citations with where each one leads.
Blocked by: C24
Acceptance:
- One row per kept citation of this answer, numbered from 1 in order of first use, in an outline card: the icon, then "<source title>: <passage heading>", "Resume: <label>" or "Logistics: <topic>" from the device index; an id that no longer exists shows as plain text (Citations card).
- The action is "Open beside the chat" for a passage, "Show in the resume" for a resume entry of any kind, and none for a logistics answer; the open citation's row is tinted, and its action reads "Shown in the resume" when it is the resume (Citations card).
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/ui/CitationsCard.tsx`, `src/chat/ui/Answer.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C26: The answer steps

Delivers: while the chat works, the visitor sees what it found, read and checked; afterwards the record folds into one line.
Blocked by: C23
Acceptance:
- While answering, each step appears in a bordered box as it happens: "Found 1 source about <topic>", "Reading <title>", and "Checking citations" from the first answer text after the last read until `chat.citations` arrives; the current step has a spinner and a moving highlight and is announced politely (Answer steps; Accessibility).
- When done, the box folds into one line above the answer, "Read 1 source and checked 3 citations", shown only when the turn read; opened, each row opens on its own: the passages read by number and heading, and "Each citation points to a passage the chat read, to the resume or to one of Peter's logistics answers." (row 138); a removed marker reads "Checked 3 citations, removed 1." (Answer steps).
- The browser test sees the steps one by one, then the answer (Testing Strategy, seam 2 bullet 1).
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/ui/AnswerSteps.tsx`, `src/chat/ui/Answer.tsx`, `src/chat/server/__tests__/fixtures.ts`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C27: Copy, Retry and follow-up questions on an answer

Delivers: a visitor can copy an answer, ask again, or go deeper with one tap.
Blocked by: C25, C22
Acceptance:
- Under each answer: Copy and Retry; the latest answer always shows them, earlier answers on hover, with how long ago (`acme-relative-time`) (Answer; row 66).
- Retry asks the question again with its saved `about`, scope and audience and replaces the answer; `answerFinished()` is never called after a Retry or on a restore (Workspace effects; Testing Strategy, seam 2). S36 checks the effect: at 390 × 844 the install offer shows after the third finished answer only.
- Up to two follow-up questions show under the citations card, as plain text in buttons, and each sends as a question with the current scope and audience (Follow-up questions; Rendering answers).
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/ui/FollowUps.tsx`, `src/chat/ui/Answer.tsx`, `src/chat/ui/ChatColumn.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C28: The resume card, and the open tools in a live stream

Delivers: "Can I see his resume?" opens the whole resume beside the chat, and "Show me where that came from" opens the passage.
Blocked by: C24, S3 (the resume view), S14 (`openResume()`, a no-op until S32)
Acceptance:
- A scripted `open_resume` turn calls `openResume()` and shows the resume card: the resume icon, "Peter's resume" and "Open beside the chat", which calls it again (The resume; Resume card; Testing Strategy, seam 2). S32 checks the effect: the Resume tab opens at its top.
- An `open_source` result in a live stream calls `openCitation(passageId, n)`; a restored conversation shows the cards but does not act again (Tools).
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/ui/ResumeCard.tsx`, `src/chat/ui/Answer.tsx`, `src/chat/ui/ChatColumn.tsx`, `src/chat/server/__tests__/fixtures.ts`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C29: Question actions and long questions

Delivers: a visitor can retry, edit or copy any question, and a pasted posting does not fill the screen.
Blocked by: C27
Acceptance:
- On hover, or a tap on phones: how long ago (`acme-relative-time`), then Retry, Edit and Copy in one icon-button group (Question actions).
- Retry asks again with the same `about`, scope and audience; Edit puts the question back in the input and moves focus there; on an earlier question both replace that answer and the ones after it (Question actions; Accessibility; Testing Strategy, seam 2).
- A question longer than four lines shows its first four, fading out, with the design system's Show more (`acme-show-more`) (Messages; row 67).
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/ui/Question.tsx`, `src/chat/ui/Messages.tsx`, `src/chat/ui/ChatColumn.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C30: Stop, "Answer stopped.", the error alert, and the announcements

Delivers: a visitor can stop an answer and recover from a failed one in one step, and a screen reader hears only that the answer is ready.
Blocked by: C27
Acceptance:
- While answering, Send becomes Stop (a plain square with a progress ring on its border) and the next question can be typed; Stop keeps what arrived, marked "Answer stopped." (the state table; Testing Strategy, seam 2).
- A scripted error, a 429 (by request interception) and a reload during an answer each show the error alert (`acme-alert`, error variant, `role="alert"`) in the answer's place with Try again and Edit question; the 429 reads "Too many questions in a short time." and "Try again in a few minutes."; a reload keeps no partial text (How a turn ends; Testing Strategy, seam 2).
- The conversation is not a live region; a streaming answer has `aria-busy="true"`; a separate polite region says only "Answer ready" or "Answer stopped." (Accessibility; Testing Strategy, seam 2).
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/ui/ChatInput.tsx`, `src/chat/ui/Answer.tsx`, `src/chat/ui/ChatColumn.tsx`, `src/chat/server/__tests__/fixtures.ts`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C31: Queued questions while an answer streams, with Send now

Delivers: a visitor can ask the next question while an answer streams and see it waiting in the conversation.
Blocked by: C30
Acceptance:
- Enter during an answer queues the question at the end of the conversation as a question message with a clock and an always-visible row: "Sends when this answer finishes", Send now, Edit and Remove; Edit, or the Up arrow in an empty input for the latest queued question, brings it back and takes it off the queue (Queued questions; Testing Strategy, seam 2).
- The queue store sends in order, one question at a time, when idle, online and not paused: after the answer, after Stop and after an error; it survives a reload; after a 429 it pauses until the visitor sends again (Saved conversation, "The queue", "Pauses").
- Send now stops the current answer, which stays, marked stopped, and sends that question first; the others keep their order (Queued questions).
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/ui/QueuedQuestion.tsx`, `src/chat/saved-conversation.ts`, `src/chat/ui/ChatColumn.tsx`, `src/chat/ui/ChatInput.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C32: Offline: questions queue, survive a reload and send when the network returns

Delivers: a visitor on a train can ask while offline and lose nothing.
Blocked by: C31
Acceptance:
- `navigator.onLine` and the `online` and `offline` events set the state; offline, the button reads Queue (cloud-off icon), Enter queues, and the row says "Sends when you're back online" with no Send now (the state table; Queued questions).
- A queued question survives a reload and sends when the network returns; a suggested question selected offline becomes a queued question (Testing Strategy, seam 2; Suggested questions).
- A request that fails before any response puts the question back at the front of the queue and shows the offline state; the chat tries again every 30 s and on `online`, and a try that gets a response clears the state (Saved conversation, "Online and offline").
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/ui/ChatColumn.tsx`, `src/chat/ui/ChatInput.tsx`, `src/chat/ui/QueuedQuestion.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C33: Two tabs: one sender, through the Web Lock

Delivers: a visitor with two tabs open has one conversation that neither tab overwrites, and each question is sent once.
Blocked by: C31
Acceptance:
- The tab that sends holds the Web Lock `pk-chat-send` for the whole turn; every send takes the lock first, and when another tab holds it, the question joins the shared queue (Saved conversation, "Tabs").
- A question sent in one tab streams only there; the other tab shows the answer when its row is written; a queued question sends once (Testing Strategy, seam 2; Objective).
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/saved-conversation.ts`, `src/chat/ui/ChatColumn.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C34: The "limit reached" state for the day and the month

Delivers: when the chat's budget is spent, a visitor gets Peter's email and the resume instead of a retry, also after a reload.
Blocked by: C31, C17, D9 (the preview's `PREVIEW_LIMIT` comes through `createOps()`)
Acceptance:
- `DAILY_LIMIT` shows "The chat has reached today's limit." and "It answers again at <00:00 UTC in the visitor's time, such as 5:00 PM> your time. Until then, you can read the resume or email Peter at <email>."; `SPEND_LIMIT` shows the month's texts with the first day of next month; "Open the resume" calls `openResume()`; there is no Try again (How a turn ends; row 138).
- The question goes back into the input only when the input is empty; the queue pauses, and the session row's `paused` marker keeps the state after a reload until the visitor sends again (Saved conversation, "Pauses").
- With the preview started with `PREVIEW_LIMIT=day`: the state shows, also after a reload, and typed text in the input stays as it is (Testing Strategy, seam 2).
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/ui/Answer.tsx`, `src/chat/ui/ChatColumn.tsx`, `src/chat/saved-conversation.ts`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C35: New chat

Delivers: a visitor can delete the conversation from their device after confirming, and start again.
Blocked by: C31, S14 (`reset()`, a no-op until S35), S23 (the app bar's end slot on phones)
Acceptance:
- New chat shows only while a conversation exists, at the top of the chat column on wide screens and in the app bar's end slot on phones (the workspace route puts it there); it opens `acme-alert-dialog` with first focus on Cancel: "Start a new chat?", "This deletes the current conversation, the open source and your choices from this device. It cannot be undone.", Cancel and New chat (New chat).
- On confirm, the chat clears each of its stores with `clearObjectStore()` (no `deleteDatabase`), calls `workspace.reset()` and `setConversationActive(false)`, makes a new `threadId` and puts focus in the input; the theme stays (New chat; Testing Strategy, seam 2). S35 checks the effect: the first view returns, and the site's `views` store is empty.
- Cancel closes the dialog and returns focus to New chat (New chat; Accessibility).
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/ui/NewChat.tsx`, `src/chat/saved-conversation.ts`, `src/chat/ui/ChatColumn.tsx`, `src/site/routes/index.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C36: Device matches

Delivers: a visitor finds a resume entry or passage as they type, also offline, without asking the chat.
Blocked by: C19, C16
Acceptance:
- The device index is fetched when the input first gets focus or the column first shows an answer or answer steps, never in the first-load JavaScript; from the third typed character, a list above the input shows up to 5 matches under "On this device, 2 matches", each with its label, its text with the typed words marked, then "Ask the chat about "<text>""; it works offline (Device matches; The build).
- Selecting a match calls `openCitation(id)` with no number (Device matches; Testing Strategy, seam 2). S32 checks the effect: a resume match shows the entry in the resume, and a passage match opens the source at it.
- The textbox keeps its role and gets `aria-autocomplete="list"`, `aria-controls` and `aria-activedescendant`; the list is a `listbox` of `option`s built with the design system's item parts; arrow keys move through it and Escape closes it; the gap is named in the code (Device matches).
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/ui/DeviceMatches.tsx`, `src/chat/device-index.ts`, `src/chat/ui/ChatInput.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C37: Scroll to the latest message

Delivers: a visitor who scrolled back reaches the latest message in one step.
Blocked by: C19
Acceptance:
- Away from the bottom, a round icon button with a down arrow floats 12 px above the input, moves up as the input grows, and scrolls to the latest message (Scroll to the latest; row 68).
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/chat/ui/ScrollToLatest.tsx`, `src/chat/ui/Messages.tsx`, `src/site/__tests__/browser.test.ts`
Size: M
Needs Peter: no

### C38: A keyboard-only pass

Delivers: every chat action works without a mouse.
Blocked by: C26, C29, C31, C35
Acceptance:
- Keyboard only: Tab reaches the input and Enter sends; Stop, Send now, a citation, the steps line, the follow-up questions, the message actions and New chat work from the keyboard and show focus (Accessibility; Testing Strategy, seam 2).
- Focus follows the spec's rules: it stays in the input after sending; Edit and "Ask about this" move it to the input (Accessibility).
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/site/__tests__/browser.test.ts` (and the chat UI files a failure points to)
Size: S
Needs Peter: no

### C39: axe across the chat states, at both sizes and in both themes

Delivers: the chat column meets WCAG 2.2 AA in every state the mockups draw.
Blocked by: C22, C26, C30, C32, C34, C35, C36, C38
Acceptance:
- axe reports no WCAG 2.2 AA violation in the answering, queued, offline, error, limit, device-matches and opened-steps states, and with the New chat dialog open, at 1440 × 900 and 390 × 844, in light and dark (Testing Strategy, seam 2).
Verify: `bun test src/site/__tests__/browser.test.ts`
Files: `src/site/__tests__/browser.test.ts` (and the chat UI files a violation points to)
Size: M
Needs Peter: no

### C40: The trick questions and `bun run evals`

Delivers: Peter has an eval suite he can run on demand, which costs nothing until he approves a run.
Blocked by: C10, C13, C14, C15 (the whole handler, with the approved prompt)
Acceptance:
- `evals/trick-questions.yaml` covers each topic outside the chat's topics; an employer, project or skill not in the record; false premises; wording upgrades; requests for `Not public` details; prompt injection in a question and in a posting; the fit check; "show me his resume"; "show me where that came from"; a scoped follow-up; one question under each audience; and citation integrity; each case states its checks with `EvalExpect` (Evals). A case may carry optional `history` (questions asked first, through `handleChat()`), `scope` and `audience` (main's decision, written into SPEC-chat).
- `bun run evals` loads `.secrets/local.env` with `--env-file`, uses `createAnthropicChat("claude-sonnet-5-5", key)`, the real `buildKnowledge()`, the in-memory log, budget (always allows) and telemetry, and the real clock; it asks each case through `handleChat()`, checks it, and writes every answer and `chat_turn` event to `.scratch/evals/<date>.md`, which git ignores (Evals).
- Nothing in `bun test` or CI runs it (Evals; SPEC-deploy, CI).
Verify: `bun test`; `git check-ignore .scratch/evals/x.md`; no run in this task.
Files: `evals/trick-questions.yaml`, `scripts/evals.ts`, `package.json`, `.gitignore`
Size: M
Needs Peter: no. The case shape is settled (main's decision); this task makes no run.

### C41: The first approved eval run, and Peter's review

Delivers: proof against the real model that the chat holds its rules, reviewed by Peter.
Blocked by: C40, D8 (`.gitignore` gains `.secrets/`); Peter: the `resume-evals` workspace and key ($5 limit) in his untracked `.secrets/local.env` (SPEC-deploy setup step 3)
Acceptance:
- One run that Peter approved passes every deterministic check (Success Criteria).
- Peter reviews the answers in the review file for tone, wording and anything the checks cannot see, and approves them; a decision-record row holds the approval (Evals; Success Criteria).
Verify: `bun run evals`, only after Peter approves this run; read `.scratch/evals/<date>.md` with him.
Files: `docs/design/interview-2026-10-26.md` (and any prompt fix the review asks for, which is approved again as in C15)
Size: S
Needs Peter: yes: approval of the run (it costs money), the key in `.secrets/local.env`, and the review of the answers.

## Checkpoints

### Checkpoint chat: contracts

After C2. `bun test src/chat` passes; the deploy module's ops work (D9) can start against the chat's types and contract suite.

### Checkpoint chat: the handler

After C15. `bun test src/chat` passes every seam-1 item in SPEC-chat's Testing Strategy; `bun run build` and `bun test` pass; a review against the Boundaries ("Never": no read, `Not public` or thinking text on the wire; no `threadId` in the log); Peter has approved the system prompt (C15).

### Checkpoint chat: the first answer

After C16 to C19, with S31. `bun run build:site`, `bun test src/site` and `bun test` pass; `bun run dev` and `bun run preview` answer a scripted question; Peter can try the first answer in the preview.

### Checkpoint chat: the answer views

After C20 to C30. The full suite passes; the conversation and answer states of the "Conversation states" and "After a question, source open" boards work in the preview, apart from the effects that S32 to S36 add. A short look by Peter here is suggested, not required by the spec.

### Checkpoint chat: queue, offline, limits

After C31 to C39. The full suite passes; Peter reviews the running chat against the approved mockups at desktop and phone sizes, in light and dark, and approves it (Success Criteria). Pushes of the chat's site files are releases under his standing approval (row 151).

### Checkpoint chat: lands

After C41 and the site's landing (S32 to S36 hold the effect checks of C20, C24, C27, C28, C35 and C36). The evals are approved; the chat rows of `AGENTS.md`'s Modules table and `spec/README.md` say built, and the fresh-session check passes.
