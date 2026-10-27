# Site concepts, 2026-10-26

Proposals for how the site presents the chat, the resume and the deep dives. None is decided. Peter chose a new web design with the chat first ([interview record](interview-2026-10-26.md), questions 21 and 22), then proposed concept A.

## Concepts

| Concept | First view | How the resume and deep dives appear | Serves best | Cost |
|---|---|---|---|---|
| A. Chat workspace with artifacts (Peter's idea) | A full chat, like Claude or ChatGPT | As artifacts in a side panel beside the chat: from a button, from a citation, or when the visitor asks the chat to open one. Questions are scoped to the open artifact; selected text gets "Ask about this". Phones open the artifact as a full-screen sheet. | The AI work sample; visitors who ask | The skimming recruiter must open the resume; the first view needs JavaScript |
| A+. Concept A with the resume open at the start | The chat on the left, the resume artifact on the right, on wide screens | As in A | Both the skimmer and the asker | Two panes to design; on phones, the same as A |
| B. Resume with a chat panel | The resume page | The chat lives in a side panel; each role and highlight has "Ask about this" | The skimming recruiter | The chat is less central than Peter chose |
| C. Search first | One "Ask or search" box | Typing shows matching resume entries at once, also offline; Enter asks the chat; answers appear as cards | Fast lookups | Less familiar; the resume is not visible as a whole |
| D. Audience first | "Who is visiting?": recruiter, hiring manager or engineer | Suggested questions, answer depth and the artifacts that open follow the choice | Tailored answers | One more step before the content; can feel like a gate |
| E. Career timeline | An interactive timeline of roles and projects | Selecting a node opens its artifact and scopes the chat to it | Seeing the career arc | The most custom design work |

## Features that work with any concept

- **Job fit brief:** the visitor pastes a job description; the chat maps each requirement to cited evidence and states the gaps plainly.
- **Answers that include site parts:** browser tools show a role card, a project card or a deep-dive link inside the answer ([research 10](../research/10-chat-knowledge-depth.md)).
- **Exact-passage highlights:** with native citations, the open artifact highlights the passage an answer used.
- **Standalone pages:** `/resume` and `/deep-dives/<id>` stay prerendered pages that read without JavaScript, for search engines, sharing and offline use. The workspace opens the same content as artifacts.

## Recommendation

A+, with the job fit brief and the standalone pages. It keeps Peter's concept and his chat-first choice, the open resume serves the skimming recruiter, and a chat that opens and cites documents through tools is the strongest work sample for AI platform roles.

The next step is mockups of the concepts Peter picks, on the "Resume site mockups" canvas.
