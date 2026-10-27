# The visitor's session is saved on their device, with a New chat control

When a visitor closes the site and comes back, it picks up exactly where they left off. Everything is saved in the visitor's own browser, and a "New chat" control clears it.

Decided 2026-10-27 by Peter.

Consequences:

- Saved: the conversation, the source open beside the chat and its marked passage, the selected role on the timeline, and the "Answers for" choice. The site restores all of them on the next visit, also when the visitor opens the installed app.
- Nothing about the visitor is stored on the server. A returning conversation sends its saved messages with the next question, as [decision 0010](0010-offline-chat.md) already requires for queued offline questions.
- "New chat" sits at the top of the chat column, not in the app bar, because it belongs to the conversation. It asks for confirmation, then deletes the saved session and opens the first view. One conversation at a time: old conversations are not kept in a list (Peter, 2026-10-27; first named "Start over").
- Browser storage can be empty or blocked (a private window, cleared site data). The site then works as a first visit.
- The site spec chooses the storage (IndexedDB or local storage) and how saved sessions move between site versions. Settled on 2026-10-27 in [SPEC-site](../../spec/SPEC-site.md): IndexedDB through TanStack DB, with a version number; an unknown version starts a first visit.
