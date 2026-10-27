# Resume

Peter Kloss's resume as one content source, the documents built from it, and the public site and chat that present it.

## Content

**Resume source**:
The file `resume.yaml`, in the JSON Resume shape plus marked extensions. The only place a resume fact is written.
_Avoid_: resume data, master resume, resume.json

**Private details**:
Facts kept out of git and out of public outputs, held in the untracked `private.yaml`. Today: the phone number.
_Avoid_: secrets, PII file

**Variant**:
Who a build is for: `public` (no private details) or `private` (with private details, for the documents Peter sends).
_Avoid_: edition, flavor, version

**Role**:
One job entry in the resume source: employer, title, dates, location and highlights.
_Avoid_: position (that is the title field), experience item

**Earlier role**:
A role printed in the compact "Earlier roles" list, with no highlights.
_Avoid_: old job, previous role

**Highlight**:
One bullet under a role, stating what Peter did and what came of it.
_Avoid_: bullet point, achievement, accomplishment

**Headline**:
The one line under Peter's name that names his target role (`basics.label`).
_Avoid_: title, tagline

**Lead**:
The short summary paragraph under the header, with the blue rule (`basics.summary`).
_Avoid_: profile, objective, about

## Documents

**Document**:
A file built from the resume source for a reader: the PDF, the Word file or the text file.
_Avoid_: export, artifact (artifact means a published claude.ai page)

**Print preview**:
The generated `resume.html` that Chrome prints to the PDF; open it to see the PDF layout.
_Avoid_: template (the template is the code that renders it)

## Site and chat

**Site**:
The public TanStack Start progressive web app: the chat, the resume beside it, and the sources it opens on demand, offline included.
_Avoid_: portfolio, website app

**Knowledge base**:
Everything the chat may answer from, in two layers: the core and the sources. Peter approves every part.
_Avoid_: knowledge file, corpus, context file, training data

**Core**:
The part of the knowledge base sent with every question: the resume entries, the logistics answers and the catalog.
_Avoid_: system prompt (that is the chat's instructions), base context

**Catalog**:
The list in the core of every approved source, each with its id, title and a one-line summary, from which the chat chooses what to read.
_Avoid_: index, table of contents

**Source**:
An approved file in the knowledge base that the chat reads only when a question needs it: a deep dive or an interview. Not the resume source, which is `resume.yaml`.
_Avoid_: document (that is a built resume file), article, page

**Passage**:
One numbered section of a source: the smallest part an answer can cite and the site can mark.
_Avoid_: chunk, snippet, paragraph

**Interview**:
A source that holds Peter's answers in his own words, each under the question asked, with transcription errors fixed and filler smoothed.
_Avoid_: transcript (the raw record, kept privately), Q&A

**Deep dive**:
A source that explains one highlight or project in the third person, written from Peter's answers: the problem, what he did, how it worked, the result and the tools.
_Avoid_: case study, project write-up

**Logistics answer**:
An entry in the core that Peter approves about his job search: remote or on-site, location, availability, target roles.
_Avoid_: FAQ, preferences

**Citation**:
The id of the passage, resume entry or logistics answer an answer used, shown with the answer.
_Avoid_: source link, reference

**Saved session**:
A visitor's conversation, queued questions, audience and open views, kept in their own browser and restored when they return. It has two parts: the saved conversation and the saved views.
_Avoid_: account, profile

**Saved conversation**:
The chat's part of the saved session: the questions and answers of the current conversation, the queued questions and the audience.
_Avoid_: chat history (that sounds like the question log), transcript

**Saved views**:
The site's part of the saved session: the open tab, the open source with its marked passage, and the scope.
_Avoid_: view state, layout

**Workspace**:
The site's main view at `/`: the app bar, the career timeline, the chat column and the document panel.
_Avoid_: dashboard, home page

**Workspace contract**:
The one interface the site gives the chat module, through which the chat reads the scope and opens what an answer cites.
_Avoid_: workspace (that is the view), API, bridge

**Career timeline**:
The full-width band of Peter's roles at their true lengths; selecting a role sets the scope.
_Avoid_: timeline chart, history bar

**Document panel**:
The area beside the chat that shows the resume, or a source opened from a citation, in tabs.
_Avoid_: artifact panel, side panel

**Scope**:
The role the chat is asking about, set from the career timeline and shown in the chat input. It never means the topics the chat answers.
_Avoid_: filter, context; "scope" for the chat's topics (say "outside the chat's topics")

**Source page**:
The standalone prerendered page of one approved source at `/sources/<id>`, readable without JavaScript.
_Avoid_: deep-dive page, article page

**Refusal**:
The chat's answer to a question outside the chat's topics (salary, immigration, health, age, personal life), or to a question the knowledge base does not cover: it declines and points to Peter's email.
_Avoid_: guardrail message, block

**Queued question**:
A question waiting to be sent, asked while offline or while an answer streams, and kept on the visitor's device.
_Avoid_: pending message, draft

**Turn**:
One question and its answer, with the reads made for it.
_Avoid_: exchange, round, request

**Read**:
One use of the chat's read tool: the text of the sources or passages the chat asked for.
_Avoid_: retrieval, lookup, search

**Answer steps**:
The record shown with an answer of what the chat did for it: the sources it found and read, and the citations it checked.
_Avoid_: thinking, reasoning, trace

**Fit check**:
The chat's answer to a pasted job description: each requirement with what Peter's record shows and its citations, or "not in Peter's record", and no verdict on fit.
_Avoid_: job match, fit score

**Audience**:
The visitor's "Answers for" choice (recruiter, manager, engineer, designer or product manager), which sets what an answer leads with.
_Avoid_: persona, mode, role (a role is a job in the resume)

**Follow-up question**:
A question the chat suggests under an answer, written for that answer.
_Avoid_: suggestion chip, related question

**Resume card**:
The card in an answer that opens the whole resume beside the chat, after a visitor asks for the resume.
_Avoid_: artifact card, attachment

**Device matches**:
The resume entries and passages that match what the visitor types, found on the visitor's own device.
_Avoid_: autocomplete, search results

**Device index**:
The labels and public text of the resume entries, logistics answers and passages, kept on the visitor's device so that device matches work offline. It never holds `Not public` material.
_Avoid_: search index, local index, cache

**Question log**:
The anonymous record the server keeps of the questions visitors ask and how each turn ended.
_Avoid_: analytics, chat history, transcript

**Trick question**:
An eval case that tries to make the chat state something false, leave the chat's topics or ignore its rules.
_Avoid_: jailbreak test, red-team prompt

## Running the site

**Release**:
A push of site changes to `main`, which goes live at peterkloss.dev once its checks pass. Peter approves each one.
_Avoid_: ship, go-live, promotion

**Site file**:
A file in the repository that can change what the live site serves. Specs, docs, tests and agent files are not site files, so a push that changes only them is not a release.
_Avoid_: app file, production file

**Release check**:
The check on a new production deployment that runs the smoke check in Chrome after CI passes. Until it passes, the deployment stays off peterkloss.dev.
_Avoid_: deploy check, gate

**Smoke check**:
A short set of requests that checks a running copy of the site, its pages, headers, redirects and the chat's request checks, without asking the model anything.
_Avoid_: end-to-end test, ping, e2e

**Health check**:
A daily check of peterkloss.dev: a smoke check, plus a look at the day before's daily totals or at whether the live site matches `main`. Two run, one on Vercel and one on GitHub, and each checks that the other ran.
_Avoid_: uptime monitor, heartbeat

**Daily totals**:
The server's per-day record of how chat turns ended, the tokens they used and how long they took, with no question text.
_Avoid_: metrics, analytics, stats

**Limit alert**:
An urgent push to Peter's phone when the chat's spend nears or reaches a limit, or when a health check, a release check or the question log's store fails.
_Avoid_: notification, page, alarm

## Making the project

**Decision record**:
The dated record of the product questions put to Peter and his answers, one numbered row per decision, in `docs/design/interview-<date>.md`. A row number names one decision, as in "row 131".
_Avoid_: "interview" alone (an interview is a source), interview notes, transcript
