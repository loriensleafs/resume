# The chat keeps an anonymous log of the questions it gets

Peter wants to see what visitors actually ask, and which questions the chat refuses or answers poorly, so that he knows which interviews to do next. The chat keeps an anonymous log on the host: each question's text, the citations of its answer, and whether it was a refusal or an error.

Decided 2026-10-27 by Peter.

This changes one line of [decision 0017](0017-saved-visitor-session.md), "Nothing about the visitor is stored on the server": the saved session still stays only in the visitor's browser, and the server now also keeps question text with no identity.

Considered: keeping nothing (Peter learns nothing about what visitors ask); daily counts only (shows use, but not which topics are thin).

Consequences:

- The log holds no IP address, visitor id, cookie or saved-session data. Visitors can still type personal details into a question, so the chat shows one line near the input saying questions are kept anonymously to improve answers.
- Entries are deleted after 90 days.
- [SPEC-deploy](../../spec/README.md) chooses the store on the host. [SPEC-chat](../../spec/README.md) defines what one entry holds and how Peter reads the log.
