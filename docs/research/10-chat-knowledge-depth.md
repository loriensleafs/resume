# Deeper chat answers from a fuller knowledge base

Researched 2026-10-26, after Peter asked for answers that are "more dynamic than it just regurgitating those markdown deep dives", from "a comprehensive knowledge base about who I am".

## What limits the answers today

The chat does not replay the deep dives. The model reads the whole knowledge file and writes a new answer to each question ([decision 0008](../decisions/0008-grounded-knowledge-file.md)). The limit is the content: 46 entries about the resume, nine projects and four logistics topics, 31,275 characters (about 8,000 tokens). A question about how Peter leads, why he chose platform work, or how he handles disagreement has no entry to answer from, so the chat must refuse or repeat a project.

## Size and cost

- Claude Sonnet 5.5 has a 1M-token context window and 128K output tokens. https://platform.claude.com/docs/en/models/sonnet-5/
- Anthropic: "If your knowledge base is smaller than 200,000 tokens (about 500 pages of material), you can just include the entire knowledge base in the prompt", and prompt caching cuts latency by more than 2x and cost by up to 90% (2024-09-19). https://www.anthropic.com/news/contextual-retrieval
- So a knowledge base ten times larger than today still fits in every request. Retrieval (embeddings, a vector index) adds parts and can miss entries; it is not needed below that size.

## Citations

- Anthropic's Citations feature is generally available on all active models. With "custom content" documents, each content block is one citable unit, and the answer returns `cited_text` and the block index range. `cited_text` does not count toward output tokens. Citations work with prompt caching but not with structured outputs. https://platform.claude.com/docs/en/build-with-claude/citations
- The TanStack AI Anthropic adapter documents prompt caching, adaptive thinking (`reasoning`) and provider options in `modelOptions`, but does not mention Citations. https://tanstack.com/ai/latest/docs/adapters/anthropic
- Today's design marks each entry with `[id]` and asks the model to cite ids. Native citations would return exact passages that the site can highlight, but need adapter support or a direct API call.

## Tools and an agent loop

- TanStack AI tools are defined once with `toolDefinition()` and run on the server (`.server()`) or in the browser (`.client()`). `chat()` runs an agent loop; `agentLoopStrategy` defaults to `maxIterations(5)` plus a stop on `length`. https://tanstack.com/ai/latest/docs/guides/tools, https://tanstack.com/ai/latest/docs/api/ai.md
- Browser tools let an answer act on the page, for example open a deep dive or the resume beside the chat, or show a role card, instead of returning only text.

## What a fuller knowledge base could hold

Each kind below is an entry type with an id, written from Peter's answers or records and approved by him, like the deep dives ([decision 0001](../decisions/0001-facts-from-records.md)).

| Kind | Example questions it answers |
|---|---|
| Career story | Why front-end platform work? How did his roles lead to AI developer tooling? |
| Working style and leadership | How does he lead without authority? How does he work with design and product? How does he review code? |
| Stories (situation, task, action, result) | Tell me about a conflict, a failure, a hard deadline, a decision he would change. |
| Principles and opinions | What does he think makes a design system succeed? How should teams adopt AI agents? |
| Projects outside jobs | His public design system, agent tooling and this site, with links. |
| Skill depth | How much has he used Lit, TanStack Table or Playwright, and where? |
| Recruiter questions in his words | What is he looking for next? Individual contributor or manager? What kind of team? |
| Logistics (exists) | Remote, location, availability, target roles. |

Topics outside the chat's scope stay out ([decision 0009](../decisions/0009-chat-scope.md)) unless Peter changes that decision.

## How the answers become more dynamic

- The prompt asks for a synthesis across entries, sized to the question, with the entries it used.
- The visitor's context goes with the question: the page or document open beside the chat, or a pasted job description.
- Browser tools show parts of the site in the answer.
- Evals grade depth and grounding, not only refusals.

Outcome: open. A fuller knowledge base changes [decision 0009](../decisions/0009-chat-scope.md) and [SPEC-knowledge](../../spec/SPEC-knowledge.md) (new entry kinds, a larger size budget), and needs more interviews with Peter.
