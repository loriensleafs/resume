# The chat answers from an approved knowledge file, not a trained model

Peter wants the chat to give deeper context about parts of his resume. Fine-tuning changes how a model writes, but it is a weak way to teach facts: the model can still invent details, cannot cite a source, and needs retraining for every change. The chat instead answers only from the knowledge file: the resume source, deep dives and logistics answers, each entry with an id it cites.

Decided 2026-10-26 by Peter.

Consequences:

- The whole knowledge file goes into each request; it is small enough to fit, so nothing is missed and no search index is needed. Prompt caching keeps the cost per question low. If the file outgrows the context, the chat gets a lookup tool instead. Replaced on 2026-10-26 by [decision 0016](0016-two-layer-knowledge.md): a core goes into each request, and the chat reads full sources through a tool.
- Peter writes or approves every entry. Deep dives come from interviews with Peter, one item at a time.
- Deep dives describe Peter's own work at interview level. They leave out internal code, customer names, security details and figures employers have not made public, which matters most for FedNow.
