# The knowledge base has two layers: a core in every request, sources read by a tool

The chat needs much more information about Peter than nine deep dives. Sending a knowledge base of about 150,000 tokens with every question costs about $141 per 1,000 questions; two layers cost about $42 or less ([research 11](../research/11-knowledge-tooling.md)).

Decided 2026-10-26 by Peter. This replaces the part of [decision 0008](0008-grounded-knowledge-file.md) that sends the whole knowledge file in each request; the rest of 0008 stands.

Considered: all in the prompt (simplest, and the chat always sees everything, but about three times the cost per question as the knowledge base grows); a vector index with embeddings (built for thousands of documents, and it adds services, keys and cost).

Consequences:

- **Core**, in every request and cached: the resume entries, the logistics answers, and a catalog of every source with its id, title and a one-line summary.
- **Sources**, read through a TanStack AI server tool when a question needs them. A source is a Markdown file in Peter's words, split into passages that each have an id, so an answer can cite and the site can mark the exact passage.
- The read shows in the answer, and a browser tool opens the cited passage beside the chat ([decision 0015](0015-sources-on-demand.md)).
- Citations stay `[id]` markers until a library returns native citations for text. The server accepts a marker only for a passage read in the same turn.
- Every source still comes from Peter or his records and needs his approval ([decision 0001](0001-facts-from-records.md)).
