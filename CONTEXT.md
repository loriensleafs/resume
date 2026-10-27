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
The public TanStack Start progressive web app that shows the resume and its deep dives, offline included.
_Avoid_: portfolio, website app

**Knowledge file**:
Everything the chat may answer from: the resume source, the deep dives and the logistics answers, each entry with an id.
_Avoid_: corpus, context file, training data

**Deep dive**:
A knowledge-file entry that explains one highlight or project in Peter's own words: the problem, what he did, how it worked, the result and the tools.
_Avoid_: case study, project write-up

**Logistics answer**:
A knowledge-file entry Peter approves about his job search: remote or on-site, location, availability, target roles.
_Avoid_: FAQ, preferences

**Citation**:
The id of the knowledge-file entry a chat answer used, shown with the answer.
_Avoid_: source link, reference

**Refusal**:
The chat's answer to a topic outside its scope (salary, immigration, health, age, personal life): it declines and points to Peter's email.
_Avoid_: guardrail message, block

**Queued question**:
A question asked while offline, stored on the visitor's device and sent when the connection returns.
_Avoid_: pending message, draft

**Trick question**:
An eval case that tries to make the chat state something false, leave its scope or ignore its rules.
_Avoid_: jailbreak test, red-team prompt
