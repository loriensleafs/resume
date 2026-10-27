# Each chat turn is a fixed workflow with one bounded read loop

Code runs every step of a turn: the request checks, the model request, the citation check, the log and the save. The model chooses only whether to read sources, which ones, and the answer text, with at most 3 reads per turn. Code enforces the read limit, the model-call ceiling, the answer length and the deadline; the prompt only explains them.

Decided 2026-10-27 by Peter ([interview record](../design/interview-2026-10-26.md) row 82).

Considered: a fixed two-step workflow, where one model call always picks the sources, code reads them, and a second call answers. Every question would cost two model calls, also when the core already answers it, and the chat could not follow a lead that a read turns up. Several agents: one read-only tool and one knowledge base give no reason for them.

Consequences:

- The read tool is the model's only way to get more evidence, and it only reads approved sources. No tool writes, sends or fetches from the internet.
- The open tools for the resume and a cited passage return a result only; the browser acts on it.
- Details, limits and tests: [SPEC-chat](../../spec/SPEC-chat.md).
