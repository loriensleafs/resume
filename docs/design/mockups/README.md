# Site mockups

The approved look of the site, as images. Peter reviewed the mockups on 2026-10-27: "I think this all looks pretty good." [SPEC-site](../../../spec/SPEC-site.md) and [SPEC-chat](../../../spec/SPEC-chat.md) are written from them.

Updated later on 2026-10-27 (canvas version 44; [interview record](../interview-2026-10-26.md) rows 81 and 85 to 105):

- Queued questions are question messages with a clock at the end of the conversation, with Send now, Edit and Remove.
- "Answers for" is a compact trigger, "Answers for: Anyone ▾", that opens a popover with a line of context, the five audiences and a line for the chosen one. The popover has no title and no Close button. On phones it is a select.
- The line about the anonymous question log shares the row with the trigger.
- The resume view has a ⋯ menu for the downloads.
- The conversation board shows the resume card.
- The "Welcome back" notice is gone.

Updated again on 2026-10-27 after the spec reviews (canvas version 45; [interview record](../interview-2026-10-26.md) rows 133 and 136). These changes wait for Peter's approval with the amended specs:

- Each answer numbers its own citations from 1, and its card lists only its own citations (row 133). Citation numbers in answers are drawn as the citation buttons on every board.
- In the resume, every highlight the latest answer cites shows its number; only the opened one is tinted, with a blue number.
- The audience lines read "Manager:" and "Recruiter:".
- The phone boards show the "Answers for" select and the anonymous-log line under the input.
- The phone sheets have no grab handle: the design system's drawer has no swipe to close.
- New input states: limit reached for the day and for the month, and "Too many questions". Their texts are proposals for Peter to approve.
- A new not-found page, desktop and phone. It has no script, so it follows the system's light or dark setting, not the visitor's own choice. Its text is a proposal for Peter to approve.
- The steps' citation line also names Peter's logistics answers (a proposal).

The mockups were made on a private Claude Design canvas, "Resume site mockups", with Peter's ACME design system 0.3.2. These images are rendered from the canvas boards. The board sources are on the branch [`prototype/site-mockups`](https://github.com/loriensleafs/resume/tree/prototype/site-mockups/prototypes/site-mockups), not on `main`, because they open only inside the canvas.

The choices behind each view are in the [interview record](../interview-2026-10-26.md), rows 21 to 75, and in decisions [0015](../../decisions/0015-sources-on-demand.md) to [0019](../../decisions/0019-wider-chat-scope.md).

## Desktop

| View | What it shows | Light | Dark |
| --- | --- | --- | --- |
| First view | The chat first, with the "Answers for" trigger and the anonymous-log line, suggested questions, the career timeline band, and the resume beside the chat with its ⋯ menu | [image](first-view-light.png) | [image](first-view-dark.png) |
| After a question, source open | The conversation at the latest answer: the steps line, an answer with citations, Copy and Retry, the citations card, follow-up questions, the scope chip inside the input, and the cited source open in a tab with its passage marked | [image](answer-with-source-light.png) | [image](answer-with-source-dark.png) |
| Returning visitor | The restored conversation, shown at the latest answer, with no notice | [image](returning-visitor-light.png) | [image](returning-visitor-dark.png) |
| Installed app | The site in its own window, with the PK icon in the title bar | [image](installed-app-light.png) | [image](installed-app-dark.png) |
| Page not found | The static not-found page: the 404 status, a heading, one line and links to the chat and to the resume | [image](page-not-found-light.png) | [image](page-not-found-dark.png) |

## Phone

| View | What it shows | Light | Dark |
| --- | --- | --- | --- |
| Typing | Matches on the device while the visitor types | [image](phone-typing-light.png) | [image](phone-typing-dark.png) |
| A role selected | The timeline band scrolled to FedNow, the role's questions, and the scope chip inside the input | [image](phone-role-selected-light.png) | [image](phone-role-selected-dark.png) |
| Source from a citation | The cited passage in a sheet over the conversation | [image](phone-source-light.png) | [image](phone-source-dark.png) |
| Install offer | The install sheet | [image](phone-install-offer-light.png) | [image](phone-install-offer-dark.png) |
| New chat | The confirmation before the conversation is deleted | [image](phone-new-chat-light.png) | [image](phone-new-chat-dark.png) |
| Page not found | The not-found page on a phone | [image](phone-page-not-found-light.png) | [image](phone-page-not-found-dark.png) |

## States and parts

| Board | What it shows | Light | Dark |
| --- | --- | --- | --- |
| Chat input states | Empty, ready, answering, answering with a queued question, stopped, offline with a queued question, error, "Answers for" opened, "Answers for" on a phone, limit reached for the day and for the month, and too many questions | [image](chat-input-states-light.png) | [image](chat-input-states-dark.png) |
| Conversation states | Question and answer actions, a long question, scrolling back to the latest message, the answer steps while answering, done and opened, and asking for the resume (the resume card) | [image](conversation-states-light.png) | [image](conversation-states-dark.png) |
| Career timeline states | The timeline band's states | [image](career-timeline-states-light.png) | [image](career-timeline-states-dark.png) |
| Career timeline on one line | The layout options; Peter chose E, the full-width band | [image](career-timeline-options-light.png) | |
| App icon | The installed app's icon: "PK" on the site's blue | [image](app-icon-light.png) | |

## Updating

When the design changes, change the canvas, render the boards again with the export script on the prototype branch, and replace the images here. Each image is the board at its canvas size: 1440 px wide for desktop boards, 390 px for phones.
