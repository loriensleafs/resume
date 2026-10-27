# TanStack AI and Vercel's AI tools for a much larger knowledge base

Researched 2026-10-26, after Peter chose sources on demand ([decision 0015](../decisions/0015-sources-on-demand.md)) and asked how TanStack AI and Vercel's AI tools could help give the chat "a lot more information".

## What each tool offers

| Need | TanStack AI 1.0 | Vercel |
|---|---|---|
| Read sources only when a question needs them | Server tools: `toolDefinition()` with `.server()`. The call shows in the answer as a tool-call part, so the visitor can see "reading the FedNow interview". `lazy: true` hides rarely used tools until the model asks for them. | AI SDK `tool()`; Anthropic tool search with `deferLoading`. |
| Open a source beside the chat | Client tools (`.client()`) run in the browser. | AI SDK `onToolCall` on the client. |
| Search the knowledge | `embed()` with eight embedding adapters (OpenAI, Cohere, Gemini, Mistral, Bedrock, Ollama, Vercel AI Gateway, Neon). No vector store or retrieval helper. | The RAG guide (2026-07-29) uses `embed`/`embedMany`, a vector store from the Marketplace (Neon pgvector or Upstash Vector), `rerank` through AI Gateway, and Workflows for ingestion. |
| Citations | Prompt markers such as `[id]`. The Anthropic adapter passes a `citations` setting on PDF or URL documents, but its response parser in 1.0 reads no citation events, so native citations do not reach the app. | The RAG guide also uses `[id]` markers, and shows a marker as a link only when that source arrived in the same message. `@ai-sdk/anthropic` returns native citations for documents (`part.citations`). Search-result blocks and custom content documents are in an open pull request (vercel/ai #16740), not released. |
| Prompt caching | On by default for the system prompt, tools and the last message; `promptCache: 'long'` gives the 1-hour cache. | `cacheControl` with `ttl: '1h'`. |
| Chat parts in the interface | Hooks only; the site draws its own parts with the design system. | AI Elements: Sources, Inline Citation, Artifact, Tool and Reasoning components, built on shadcn/ui and copied into the project. The site says AI Elements moves to shadcn/ui and is deprecated at the end of November 2026. |
| One key, budgets and failover across providers | `@tanstack/ai-vercel-gateway` adapter (OpenAI-compatible API). Its guide does not say that Anthropic prompt caching passes through. | AI Gateway: no markup on token prices, budgets, request logs, failover. Budgets do not cover your own provider keys (BYOK), and BYOK needs purchased credits. |
| Memory per visitor | `memoryMiddleware` (in-memory, Redis, mem0, Honcho, Hindsight). It stores conversation turns; it is not a knowledge base. | Write your own `saveChat` and `loadChat`. |
| Several agents | Subagents with a router; each agent makes its own `chat()` call. | `ToolLoopAgent`; Workflow SDK for durable runs. |

Sources: [TanStack AI vs Vercel AI SDK](https://tanstack.com/ai/latest/docs/comparison/vercel-ai-sdk), [tools](https://tanstack.com/ai/latest/docs/tools/tools), [lazy tool discovery](https://tanstack.com/ai/latest/docs/tools/lazy-tool-discovery), [embeddings](https://tanstack.com/ai/latest/docs/embeddings), [memory](https://tanstack.com/ai/latest/docs/memory/overview), [subagents](https://tanstack.com/ai/latest/docs/tutorials/subagents), [Anthropic adapter](https://tanstack.com/ai/latest/docs/adapters/anthropic) and its Advanced page, the `@tanstack/ai-anthropic` 1.0.0 package source, [TanStack AI with AI Gateway](https://vercel.com/kb/guide/tanstack-ai-vercel-ai-gateway), [RAG with citations on Vercel](https://vercel.com/kb/guide/building-ai-chat-app-with-rag-and-citations-on-vercel), [AI SDK Anthropic provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic), [vercel/ai #16740](https://github.com/vercel/ai/pull/16740), [AI Elements](https://elements.ai-sdk.dev/), [AI Gateway](https://vercel.com/docs/ai-gateway), [AI Gateway pricing](https://vercel.com/docs/ai-gateway/pricing), [Chat SDK with TanStack AI](https://chat-sdk.dev/docs/ai/tanstack-ai).

## Anthropic features underneath

- **Search-result blocks:** a tool result can hold `search_result` blocks (source, title, text blocks). Claude cites whole text blocks and returns `cited_text`, which is free of output tokens. Citations are all on or all off per request. Neither library exposes these blocks yet. https://platform.claude.com/docs/en/build-with-claude/search-results
- **Sonnet 5.5 prices** per million tokens: input $2, 5-minute cache write $2.50, 1-hour cache write $4, cache hit $0.10, output $10. The 1M-token context has no long-context surcharge on Sonnet 5.5; Haiku 5.5 costs five times more above 100,000 tokens. https://platform.claude.com/docs/en/about-claude/pricing

## Three ways to give the chat more information

Estimated cost, computed with a short Bun script: Sonnet 5.5 prices above, 3 questions per visit with the first one missing the cache, 600-token answers.

| Layout | How it works | Cold question | Warm question | Per 1,000 questions |
|---|---|---|---|---|
| Today | The whole knowledge file (about 8,000 tokens) in every request | $0.026 | $0.007 | about $13 |
| All in the prompt | A knowledge base of about 150,000 tokens in every request | $0.381 | $0.021 | about $141 |
| Two layers | A core of about 20,000 tokens in every request (resume, logistics, and a catalog of every source with a one-line summary); the model reads about 8,000 tokens of full sources through a server tool when a question needs them | $0.074 | $0.026 | about $42 or less, because many questions need no source |

A vector index (the Vercel RAG guide) is the third pattern. It is built for thousands of documents. Peter's knowledge base stays far below that, so embeddings, a vector store, reranking and an ingestion workflow add services, keys and cost without a gain. If a search becomes necessary, a keyword search over the source files runs in the Bun server with no new service.

## What helps this site

- **TanStack AI server tools** fit sources on demand: the model reads a source by id from the catalog, the read shows in the answer, and a client tool opens the cited passage beside the chat.
- **`[id]` markers stay** until a library supports native citations for text. The site checks each marker against the sources read in that turn, as the Vercel guide does, so an invented id never becomes a link. Small passages, each with its own id, let the site mark the exact passage.
- **Prompt caching** is already automatic; the 1-hour cache costs more per write and helps only if visits are close together.
- **Not needed now:** AI Gateway (one provider, and the Anthropic Console spend limit already caps cost), AI Elements (the site uses Peter's design system; AI Elements is being deprecated), vector stores, Workflows, Chat SDK and memory middleware.

Outcome: Peter chose two layers on 2026-10-26 ([decision 0016](../decisions/0016-two-layer-knowledge.md)). The content plan (what new sources to gather) is separate and does not depend on the layout: each source is a Markdown file in his words either way.
