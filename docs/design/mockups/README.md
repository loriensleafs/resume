# Site mockups

The approved look of the site, as images. Peter reviewed the mockups on 2026-10-27: "I think this all looks pretty good." SPEC-site (see the [capability map](../../../spec/README.md)) will be written from them.

The mockups were made on a private Claude Design canvas, "Resume site mockups", with Peter's ACME design system 0.3.2. These images are rendered from the canvas boards. The board sources are on the branch [`prototype/site-mockups`](https://github.com/loriensleafs/resume/tree/prototype/site-mockups/prototypes/site-mockups), not on `main`, because they open only inside the canvas.

The choices behind each view are in the [interview record](../interview-2026-10-26.md), rows 21 to 75, and in decisions [0015](../../decisions/0015-sources-on-demand.md) to [0019](../../decisions/0019-wider-chat-scope.md).

## Desktop

| View | What it shows | Light | Dark |
| --- | --- | --- | --- |
| First view | The chat first, with "Answers for", suggested questions, the career timeline band and the resume beside the chat | [image](first-view-light.png) | [image](first-view-dark.png) |
| After a question, source open | The steps line, an answer with citations, Copy and Retry, the citations card, follow-up questions, the scope chip inside the input, and the cited source open in a tab with its passage marked | [image](answer-with-source-light.png) | [image](answer-with-source-dark.png) |
| Returning visitor | The "Welcome back" notice and the restored conversation, shown at the latest answer | [image](returning-visitor-light.png) | [image](returning-visitor-dark.png) |
| Installed app | The site in its own window, with the PK icon in the title bar | [image](installed-app-light.png) | [image](installed-app-dark.png) |

## Phone

| View | What it shows | Light | Dark |
| --- | --- | --- | --- |
| Typing | Matches on the device while the visitor types | [image](phone-typing-light.png) | [image](phone-typing-dark.png) |
| A role selected | The timeline band scrolled to FedNow, the role's questions, and the scope chip inside the input | [image](phone-role-selected-light.png) | [image](phone-role-selected-dark.png) |
| Source from a citation | The cited passage in a sheet over the conversation | [image](phone-source-light.png) | [image](phone-source-dark.png) |
| Install offer | The install sheet | [image](phone-install-offer-light.png) | [image](phone-install-offer-dark.png) |
| New chat | The confirmation before the conversation is deleted | [image](phone-new-chat-light.png) | [image](phone-new-chat-dark.png) |

## States and parts

| Board | What it shows | Light | Dark |
| --- | --- | --- | --- |
| Chat input states | Empty, ready, answering, answering with a question waiting, stopped, offline and error | [image](chat-input-states-light.png) | [image](chat-input-states-dark.png) |
| Conversation states | Question and answer actions, a long question, scrolling back to the latest message, and the answer steps while answering, done and opened | [image](conversation-states-light.png) | [image](conversation-states-dark.png) |
| Career timeline states | The timeline band's states | [image](career-timeline-states-light.png) | [image](career-timeline-states-dark.png) |
| Career timeline on one line | The layout options; Peter chose E, the full-width band | [image](career-timeline-options-light.png) | |
| App icon | The installed app's icon: "PK" on the site's blue | [image](app-icon-light.png) | |

## Updating

When the design changes, change the canvas, render the boards again with the export script on the prototype branch, and replace the images here. Each image is the board at its canvas size: 1440 px wide for desktop boards, 390 px for phones.
