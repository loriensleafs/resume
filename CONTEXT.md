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
The id of the passage or resume entry an answer used, shown with the answer.
_Avoid_: source link, reference

**Saved session**:
A visitor's conversation and open views, kept in their own browser and restored when they return.
_Avoid_: account, profile

**Refusal**:
The chat's answer to a topic outside its scope (salary, immigration, health, age, personal life): it declines and points to Peter's email.
_Avoid_: guardrail message, block

**Queued question**:
A question asked while offline, stored on the visitor's device and sent when the connection returns.
_Avoid_: pending message, draft

**Trick question**:
An eval case that tries to make the chat state something false, leave its scope or ignore its rules.
_Avoid_: jailbreak test, red-team prompt
