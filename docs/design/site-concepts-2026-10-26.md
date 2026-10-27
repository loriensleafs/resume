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

## Merged concept (proposed after the mockup review)

All six concepts are mocked up on the "Concepts" page of the "Resume site mockups" canvas. A review of the rendered views, with the design-critique, Impeccable and UXKIN guidance, led to one merged concept on the "Merged" page:

| Part | From | What it does |
|---|---|---|
| Chat beside the document panel | A+ | The chat leads; the resume is open from the start. |
| Career timeline as the panel's header | E | Each role is a span at its true length. Selecting a role opens the resume at it and scopes the chat. Roles an answer cites light up. |
| Numbered citations | A+ | Sources are numbered in the answer, and the cited resume line is highlighted. |
| "Answers for" choices in the composer | D | Optional; no gate before the chat. |
| Instant on-device matches while typing | C | Works offline; "Ask the chat" stays one tap away. |
| "Ask about this" on resume lines | B | Opens a question scoped to that line. |

Fixes from the review: the download control is secondary, not the loudest element; no small label above a heading; no grid of same-size cards; timeline spans read as data, not loading placeholders. Open question: the timeline shows the gap from 2012 to 2013 as empty space.

## Merged concept, updated 2026-10-27

The "Merged" page now follows decisions 0015 to 0019:

| Board | What it shows |
|---|---|
| Merged: first view | The intro says answers come from the resume and the sources behind it; "Install app" in the app bar; a suggested question about Peter's opinions |
| Merged: after a question, source open | "Read 1 source" above the answer; citations name passages; the panel shows the source with the cited passage marked and "Ask about this passage"; "Start over" in the app bar |
| Merged: phone, source from a citation | The cited passage in a sheet over the conversation |
| Merged: phone, install offer | An install sheet after a few questions: opens on its own, keeps the conversation, readable offline |
| Merged: phone, Start over | The confirmation: it deletes the conversation, the open source and the visitor's choices from this device |
| Merged: returning visitor, session restored | A notice that the conversation from an earlier day is restored and saved only in this browser |
| Merged: installed app, its own window | The app without browser controls, with its icon and name in the title bar |
| App icon options | A. PK monogram, B. career timeline spans, C. chat bubble, D. pwk; each as a rounded square, a circle, and at 48 and 32 px |

Later on 2026-10-27 (interview rows 37 to 40): icon B, the career timeline mark, sits next to Peter's name in the app bar. The career timeline moved out of the right panel into a full-width band under the app bar, at true length with every name on one line; phones scroll it sideways and open at the latest roles. A new phone board shows a selected role and its scope. The "About" chip in the composer is renamed "Asking about FedNow", and its × says "Ask about all roles". Every Merged view has a light or dark switch in its Tweaks, and the "Merged, dark" page shows them all in dark mode.

Later still (interview rows 41 to 52): "Start over" became "New chat" at the top of the chat column. The send button sits to the right of the input, with its states on the board "Chat input: send button states"; while an answer streams, Stop is a plain square with a progress ring on the button's border. The error and the "Welcome back" notice use the design system's alert. "New chat" and "Install app" use the secondary button, and "Install app" has Chrome's install icon. The source tab carries its own close ×. The band's heading reads "Career timeline", without state lines. In the app bar, a blue box with "Peter Kloss" replaces icon B and the bold name; the installed app's icon is option A, "PK" in Google Sans.

Rows 53 to 55: the page is now "Merged, light and dark", with each view's light and dark versions side by side, desktop first, then phones, then the chat input, app icon and timeline boards. The source tab closes with the same × as the scope chip. The send button sits inside the input, with no box around the two.

Rows 56 to 59: the send button is an end add-on inside a one-line input. The error alert uses the alert's heading, so its circled "!" lines up with the text. Queued questions, offline or asked during an answer, show in a notice with a clock icon, the question and ×; the Up arrow key in an empty input brings one back. The board "Chat input states" has a seventh state for a question waiting during an answer.

Rows 60 to 63: alert icons stay on the first line of text. A new board pair, "Conversation states", shows a hovered question (time sent, Retry, Edit, Copy) and the answer steps while answering, when done (one closed line) and opened. The answer view's "Read 1 source" row became that closed steps line.

Rows 64 to 68: the "Conversation states" boards now hold seven states: a hovered question with its grouped actions, a long question with Show more, answer actions (an earlier answer on hover, the latest always), scrolling up with the jump-to-latest button, and the steps while answering, done and opened in a bordered box. The answer and return views show Copy and Retry under the latest answer.

Rows 69 to 71: every message keeps a 28 px action row, shown or not, and messages sit 20 px apart, on desktop and phone. Answers use the questions' text size. The returning-visitor view now keeps its notice above the conversation and shows the conversation scrolled to the latest answer.

Rows 72 to 74: an answer reads steps line, text, Copy and Retry, then its citations in an outline card. Steps use the full chat width. The scope chip sits inside the input.

Peter approved the mockups on 2026-10-27 (row 75). Images of every board are in [mockups/](mockups/README.md).
