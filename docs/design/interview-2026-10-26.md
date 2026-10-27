# Interview record, 2026-10-26

Questions put to Peter in the session that started the site and chat, and his answers. Each answer is quoted or restated as he gave it. The decision records own the reasons.

## Intent

Peter asked for: every AI agent supported in this repository (AGENTS.md, CLAUDE.md, README updates, repo skills); a "docs version" of the resume; a public version of the resume site; and an AI chat that answers questions about his resume and history. Later in the session: "the chat using TanStack AI and for the page itself maybe the personal design system of mine", and "I'd like for this app to be a progressive web app that also functions offline", using TanStack Router, Query and DB. And: "All the artifacts from the brain plug-in should be part of this repository."

## Questions and answers

| # | Question | Answer |
|---|---|---|
| 1 | Which other documents should the build make? | Word file and plain text ([0011](../decisions/0011-word-and-text-documents.md)) |
| 2 | Site scope: page now and chat later, both now, page only, or no site? | Page and chat now |
| 3 | Where should the resume content live? | One YAML data file in the JSON Resume shape ([0005](../decisions/0005-yaml-source.md)) |
| 4 | Should the repository become public? | Public, with the phone number kept out of git ([0006](../decisions/0006-public-repo-private-details.md)) |
| 5 | What may the chat answer? | Resume facts plus approved logistics. Peter added: he wants the chat to give "deeper information on context about certain parts of the resume", and asked whether training the agent or the knowledge file is the way ([0008](../decisions/0008-grounded-knowledge-file.md), [0009](../decisions/0009-chat-scope.md)) |
| 6 | React or Lit, and which app shape? | React, because TanStack AI and DB have no Lit adapters; first "either option one or option two", then TanStack Start once the PWA requirement was added ([0007](../decisions/0007-tanstack-start-pwa.md)) |
| 7 | What does the chat do offline? | Keep history readable and queue new questions ([0010](../decisions/0010-offline-chat.md)) |
| 8 | Approve the capability map? | Approved ([spec/README.md](../../spec/README.md)) |
| 9 | Test seams for the content module? | `build()` plus renderer unit tests |
| 10 | Approve SPEC-content.md? | Approved |
| 11 | Where do open issues live? | Local markdown under `.scratch/` |
| 12 | Rewrite the first commit and force-push? | Yes |
| 13 | Make the repository public now or at launch? | Now |
| 14 | Hosting | Peter: "I’m happy to pay a little bit for the hosting of this." Host: Vercel ([0012](../decisions/0012-vercel-pro-host.md)). The first version of this question mixed host and plan; Peter answered `/wait-what`, and it was split |
| 15 | Vercel plan | Pro, $20/month |
| 16 | Chat model | Claude Sonnet 5.5 ([0013](../decisions/0013-claude-sonnet-model.md)) |
| 17 | Logistics: work arrangement | "Any arrangement nearby". Approved wording in `knowledge/logistics.yaml` |
| 18 | Logistics: location | "I'd consider relocating for the right role" |
| 19 | Logistics: availability | Available now. Peter added: "The only caveat to the being able to start immediately is if I need to relocate, that could change things." |
| 20 | Logistics: target roles | Senior, Staff or Lead roles in front-end platform engineering, design systems, and AI developer tooling and AI platform work. Peter approved all four answers together |
| 21 | Site: the look of the resume page (the PDF's look, the PDF's look plus side navigation, or a new web design) | A new web design. The recommendation was the PDF's look |
| 22 | Site: what a visitor sees first (resume, chat or featured deep dives) | The chat first. The recommendation was the resume first |
| 23 | Site: test seams | The site build output, plus one real-browser test |
| 24 | Site: speed and accessibility targets | No WCAG 2.2 AA violations; main content visible in under 2.5 s and layout shift under 0.1 on a throttled phone profile; first-load JavaScript under 200 KB compressed |
| 25 | Site: are the deep dives still worth having if the chat answers in more depth (deep-dive tabs, sources on demand, or none)? | Sources on demand ([0015](../decisions/0015-sources-on-demand.md)). Peter added that his interview answers were "much more dense" than the deep dives, and asked to recover them, brief them up or add other sources, because "we're going to have to somehow be able to provide this AI with a lot more information" |
| 26 | Knowledge layout: all in the prompt, or two layers (a core in every request, full sources read by a tool)? | Two layers ([0016](../decisions/0016-two-layer-knowledge.md)) |
| 27 | (Peter, 2026-10-27) Saved sessions | "Everything should stay saved to local storage or saved locally somehow. So that if they close the app but then come back to it, it'll pick up exactly where they left off." Also a way to "clear and start over" ([0017](../decisions/0017-saved-visitor-session.md)) |
| 28 | (Peter, 2026-10-27) Domains | Peter asked to get www.peterkloss.com and www.pk.com, both opening the same site. Both are registered by others: peterkloss.com since 2005 (Cronon GmbH, expires 2027-10-08), with another person's unfinished site; pk.com since 1997 (GoDaddy, every transfer and update locked, expires 2031-09-03). Peter then named peterwkloss.com, peterwatsonkloss.com and peterklossal.com. These three, and peterkloss.dev and peterkloss.net, return "not found" from their registries on 2026-10-27, so they appear to be free. pwk.com is registered since 1997 (Tucows, transfer and update locked, expires 2027-02-11) and points to a domain-parking service. Other endings, 2026-10-27: pk.dev, pk.app, pk.me and pk.io are registered; peterkloss.dev, peterkloss.app, peterkloss.me, peterkloss.io, pkloss.dev, pkloss.me and pwk.dev return "not found"; .ai and .co registries could not be read. Peter buys any domain; agents never buy |
| 29 | (Peter, 2026-10-27) Install | The site offers to install itself as an app, on phones and on computers. "When it installs, it should open a standalone app." |
| 30 | (Peter, 2026-10-27) App icon | Design "a little logo for the app" for the installed app |
| 31 | (Peter, 2026-10-27) Domain plan | "lets try to use peterkloss.dev as main with pkloss.dev and pwk.dev both as short ones" ([0018](../decisions/0018-domains.md)) |
| 32 | Interview recovery: how to gather new material, now that the dialog answers are lost from the chat history? | Long-form interviews, one topic at a time, in normal chat messages. Peter then attached his own copy of the 2026-10-26 interview; it is kept privately |
| 33 | Which kinds of material should the interviews gather? | Career and working style; stories and opinions; side projects and skills. Not interests outside work ([0019](../decisions/0019-wider-chat-scope.md)) |
| 34 | How much cleanup of spoken answers before approval? | Fix transcription errors and smooth filler and false starts, without changing meaning. The recommendation was errors only |
| 35 | Test seams for the updated knowledge spec | The same two seams, extended: `buildKnowledge()` and the source parser |
| 36 | Approve the updated SPEC-knowledge? | Approved. Peter added that four specs in the capability map are not written yet (site, chat, deploy, agents), and that the mockups must reflect the latest changes |
| 37 | App bar: should the app icon replace the name, or sit next to it? | Next to the name. Peter asked whether the name should take the blue accent; the advice was to keep it in ink, because blue marks links, selection and citations on this site, and the icon already carries the blue |
| 38 | Which app icon? | B, the career timeline mark: four role spans on the site's blue |
| 39 | The career timeline on one line: which layout? | Peter rejected equal widths ("loses the timeline feel") and chose E: a full-width band under the app bar, at true length, every name on one line; on narrow screens and phones it scrolls sideways and opens at the latest roles |
| 40 | (Peter, 2026-10-27) Mobile and dark mode | Asked to see the band on a phone and every Merged view in dark mode |
| 41 | The reset button: "Start over" in the app bar, or "New chat"? Keep old conversations? | "New chat" at the top of the chat column; it replaces the conversation after a confirmation, with no history list ([0017](../decisions/0017-saved-visitor-session.md)). Peter also asked what the "About: FedNow" chip means: it is the chat's scope from the selected role, renamed "Asking about FedNow" |
| 42 | (Peter, 2026-10-27) Chat input | The send button sits to the right of the input, as in most chat interfaces; "Answers for" stays underneath. The button has states: empty (off), ready, answering (it becomes Stop), stopped, offline (it queues the question) and error (Try again). Drawn on the board "Chat input: send button states" |
| 43 | (Peter, 2026-10-27) Answering and Stop | While an answer streams, a Material-style progress ring turns around the button, and Stop is a plain square, not a circled icon |
| 44 | (Peter, 2026-10-27) Error pattern: does the failed question go back into the input? | Checked: in ChatGPT and chat kits such as Stream, the failed question stays in the conversation and the retry appears where the answer should be; no source found that moves it back into the input. Drawn: the question stays, the error takes the answer's place with "Try again" and "Edit question" (which puts it back in the input) |
| 45 | (Peter, 2026-10-27) Selected role on the timeline | Only blue, no extra height; the name turns bold. Cited roles are blue with names in normal weight |
| 46 | (Peter, 2026-10-27) Progress ring | The ring turns on top of the Stop button's border, not outside it |
| 47 | (Peter, 2026-10-27) Notices | The error ("The answer didn’t arrive") and the "Welcome back" notice use the design system's alert; the welcome notice has a dismiss control. The offline "Queued" notice was changed to the same dismissible alert, to match |
| 48 | (Peter, 2026-10-27) New chat and Install app | Both use the design system's secondary button, the one with the dimmed border. Install app uses Chrome's own install icon, an arrow pointing down into a monitor (Material "install_desktop") |
| 49 | (Peter, 2026-10-27) Closing the source | The close × sits in the source's tab, after its title, not in the document |
| 50 | (Peter, 2026-10-27) Timeline heading | "Career timeline". The state lines next to it ("FedNow is selected, and the chat is scoped to it", "Restored: …") are removed; the instructions "Select a role to read it and scope the chat" and "Swipe for earlier roles" stay |
| 51 | (Peter, 2026-10-27) App bar name | A blue box with rounded corners and "Peter Kloss" inside replaces icon B and the bold name (replaces the answers to questions 37 and 38), because the timeline icon did not say it is Peter's app |
| 52 | (Peter, 2026-10-27) Installed app icon | "PK" in capitals in Google Sans on the site's blue, option A (settles question 30) |
| 53 | (Peter, 2026-10-27) Light and dark together | One canvas page, "Merged, light and dark", shows each view in light and dark side by side, desktop and phone. The separate "Merged, dark" page is gone |
| 54 | (Peter, 2026-10-27) Tab close icon | A simple ×, the same icon as in the "Asking about FedNow" chip |
| 55 | (Peter, 2026-10-27) Send button inside the input | Peter wondered whether the send button belongs inside the input, without the outline around it. Drawn for his review: the button sits inside the input at its right end, and the box around the input and the button is gone; "Answers for" stays underneath |
| 56 | (Peter, 2026-10-27) Send button placement | An end add-on inside the input, centered like the clear × in a design-system text input, in every state. Every input starts at one line |
| 57 | (Peter, 2026-10-27) Error alert | The design system's error alert with its circled "!" icon, the message as the alert's bold heading, the icon centered on it |
| 58 | (Peter, 2026-10-27) Offline queue notice | No "Queued:" label; the clock icon says it. The notice keeps the question, when it sends, and × |
| 59 | (Peter, 2026-10-27) Questions asked during an answer | Enter during an answer queues the new question in the same notice (clock, question, ×); it sends when the answer finishes. In an empty input, the Up arrow key brings a queued question back into the input and takes it off the queue. This applies to the offline queue too |
| 60 | (Peter, 2026-10-27) Alert icon alignment | The icon stays on the first line of the text, also when the text wraps. The × and the actions line up with that first line |
| 61 | (Peter, 2026-10-27) Question actions | Hovering a question shows how long ago it was sent, then Retry, Edit and Copy icon buttons. Drawn: Edit puts the question back in the input; on an earlier question, Retry and Edit replace that answer and the ones after it; on phones, a tap shows the row |
| 62 | (Peter, 2026-10-27) Answer steps | While the chat works, its steps show one by one, not expandable yet; the current step has a spinner and a moving highlight over its text. After the answer, the steps stay above it as one closed line that opens, and steps with details open on their own. Drawn steps: finding the source, reading it (its passages), checking the citations |
| 63 | (Peter, 2026-10-27) Artifact cards in the chat | Peter was unsure whether cards like Claude's artifact cards fit this site. Advice given: the citation list already does that job for sources; the one case that fits is the resume file when a visitor asks for it. Open |
| 64 | (Peter, 2026-10-27) Action buttons | Retry, Edit and Copy sit in one design-system icon button group, close together |
| 65 | (Peter, 2026-10-27) Opened steps | Like Claude's: a bordered box, one row per step with dividers, no indent; each row opens on its own. The summary line above it has its indicator right after the text |
| 66 | (Peter, 2026-10-27) Answer actions | Under each answer, on hover: Copy and Retry, then how long ago. The latest answer always shows Copy and Retry. Drawn: its time shows on hover |
| 67 | (Peter, 2026-10-27) Long questions | A question past a length shows truncated, with the design system's Show more. Drawn: four lines, fading out |
| 68 | (Peter, 2026-10-27) Scroll to the latest | Away from the bottom of a long conversation, a floating round icon button with a shadow and a down arrow sits just above the input, moves with a growing input, and scrolls to the bottom when selected |
| 69 | (Peter, 2026-10-27) Message spacing | The space between a question and its answer matches the space between an answer and the next question. Every message keeps room for its action row, shown or not, and the steps line fits between a question and its answer. Drawn: a 28 px action row under each message and 20 px between messages |
| 70 | (Peter, 2026-10-27) Action icon spacing | Spaced like Claude's: drawn as the design system's tiny icon buttons, 4 px apart, under questions and answers alike |
| 71 | (Peter, 2026-10-27) Text sizes | Answers use the same text size as questions; the steps line uses that size too, in gray |
| 72 | (Peter, 2026-10-27) Answer layout | Copy and Retry come right after the answer text, before the citations. The citations sit in the design system's outline card |
| 73 | (Peter, 2026-10-27) Widths | Messages and answer steps use the full width of the chat column; the steps line and the step box are the same width. In the canvas, styles set on the design system's own elements did not apply, which indented the steps; they now sit on plain wrappers |
| 74 | (Peter, 2026-10-27) Scope chip | "Asking about FedNow, 2021 – 2024" sits inside the input, above the text, on desktop and phone |
| 75 | (Peter, 2026-10-27) Mockup review and where they live | "I think this all looks pretty good." Only the chosen app icon stays. The mockups go into the repo: images of every board, light and dark, on `main` in `docs/design/mockups/`, and the board sources on the branch `prototype/site-mockups`. The recommendation was this split |

After question 24, Peter asked for mockups of the site with his design system before the site spec is written. They are on a private Design canvas, "Resume site mockups", for his review.

## Still open

- The site's visual design: Peter's review of the mockups.
- Buying the domains (question 31): Peter buys them.
