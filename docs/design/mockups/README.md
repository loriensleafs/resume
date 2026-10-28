# Site mockups

The approved look of the site, as images. Peter reviewed the mockups on 2026-10-27: "I think this all looks pretty good." [SPEC-site](../../../spec/SPEC-site.md) and [SPEC-chat](../../../spec/SPEC-chat.md) are written from them. The changes since that review are under "Updating".

The mockups were made on a private Claude Design canvas, "Resume site mockups", with Peter's ACME design system, now at 0.3.3. These images are rendered from the canvas boards. The board sources are on the branch [`prototype/site-mockups`](https://github.com/loriensleafs/resume/tree/prototype/site-mockups/prototypes/site-mockups), not on `main`, because they open only inside the canvas.

The choices behind each view are in the [decision record](../interview-2026-10-26.md), rows 21 to 75, and in decisions [0015](../../decisions/0015-sources-on-demand.md) to [0019](../../decisions/0019-wider-chat-scope.md).

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

The [update-mockups skill](../../../.agents/skills/update-mockups/SKILL.md) changes the mockups. Each image is the board at its canvas size: 1440 px wide for desktop boards, 390 px for phones.

One dated line per change, with the canvas version and the [decision record](../interview-2026-10-26.md) rows that hold the details:

- 2026-10-27, canvas version 44, rows 81 and 85 to 105: queued questions with Send now, Edit and Remove; the compact "Answers for" trigger with its popover, a select on phones; the anonymous-log line beside the trigger; the resume's ⋯ menu for the downloads; the resume card; no "Welcome back" notice.
- 2026-10-27, canvas version 46, rows 133, 136, 138 and 139: each answer numbers its own citations; the resume shows the cited highlights' numbers; the audience lines "Manager:" and "Recruiter:"; the "Answers for" select and the anonymous-log line on phones; phone sheets with no grab handle; the limit and "Too many questions" input states; the not-found page, desktop and phone; the logistics answers in the steps' citation line. Peter approved the texts in row 138 and the boards in row 139.
- 2026-10-27, canvas version 46, row 172: the boards use the design system 0.3.3. The bundle built at 0.3.3 is byte-identical to the 0.3.2 bundle, so the canvas keeps version 46. A new render of all 30 boards matches the approved images, so the images stay. The "First mockups" page keeps its title note "ACME design system 0.3.2", because that page was made with 0.3.2.
