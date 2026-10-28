---
name: write-source
description: Interview Peter on one subject and write a knowledge source from his answers, for his approval. His raw answers go word for word to his private repo first; then come the draft source in knowledge/sources/, his approval in the question tool and the release. Use when Peter wants an interview, or wants the chat to know more about his career, working style, stories, opinions, side projects or skills; when a draft source needs writing, checking or approval; and before any change to an approved source.
---

# Write a source

An interview source holds Peter's answers in his own words, each under the question asked. The chat reads it only after Peter approves it ([SPEC-knowledge](../../../spec/SPEC-knowledge.md): "Sources", "Drafts and approval" and "How interviews are gathered").

His raw answers can hold colleague names and internal links, and this repository is public. So the raw answers and the redaction list live only in his private repo `loriensleafs/resume-private`, in its folder `interviews/` ([decision 0024](../../../docs/decisions/0024-private-interview-repo.md)). This repository gets only the source written from them.

Steps 2, 3 and 6 need Peter, who answers in the session that talks with him. A sub-agent cannot reach him, so it stops before each of these steps and reports to its parent.

## 1. Attach the private repo

The private clone is the folder `resume-private` beside the main checkout. The main checkout is the first path that `git worktree list` prints. Keep the clone outside every checkout of this repository, so that no raw answer can be staged here. Write the clone's full path into each command; a shell variable does not reach the next command.

```sh
gh repo clone loriensleafs/resume-private <clone>
git -C <clone> pull --ff-only
gh api repos/loriensleafs/resume-private --jq '.private, .permissions.push'
ls <clone>/interviews
```

Leave out `gh repo clone` when the clone exists. The `gh api` command prints two lines: whether the repo is private, then whether you can push to it. When a command fails, or a line prints anything but `true`, stop: write no answer anywhere, and tell Peter what failed. A first line that is not `true` means the repo is not private, so its `interviews/` folder may be public now; tell him that first. Any other failure means the private repo is not attached. The interview starts only once both lines print `true`, because step 4 saves every answer there before anything is written from it.

Done when `ls <clone>/interviews` succeeds and the `gh api` command prints `true` twice: the repo is private and you can push to it.

## 2. Agree the subject

One interview covers one subject: `career`, `working-style`, `story`, `opinion`, `side-project` or `skill`. The table of planned subjects in SPEC-knowledge's "How interviews are gathered" says what each one answers. A new subject or source is Peter's decision (SPEC-knowledge, Boundaries, "Ask first"). Ask him which subject this interview covers through `ask-user-question:ask-user-question`.

Recommend the first subject in the table that has no approved interview source yet. This command lists the subject and status of each source; when `knowledge/sources/` holds no file, no subject has one:

```sh
grep -H -E '^(subject|status):' knowledge/sources/*.md
```

Done when Peter named the subject.

## 3. Interview Peter

Ask each question in a normal chat message, one question at a time, and wait for his answer, typed or spoken. Never ask through the question tool: the chat history keeps no answer given there (SPEC-knowledge, "How interviews are gathered"). AGENTS.md sends each decision for Peter through `ask-user-question:ask-user-question`, and an interview question is not a decision.

- Ask toward what the subject's row in the table answers, and follow up on what he says. Keep to his work: personal life, salary, immigration, health and age are outside the chat's topics.
- Each question as asked becomes a passage heading in step 5. Note its exact words.
- When Peter answers, write the question and his answer into the raw answers file of step 4 at once. A compaction keeps no answer word for word.

Done when Peter says the subject is covered.

## 4. Save the raw answers

The raw answers file is `interviews/<date>-<subject>.md` in the clone, with the interview's date as `YYYY-MM-DD`. When the file exists from earlier on the same day, add to its end. It holds each question as asked and Peter's answer as it arrived, word for word, with its transcription errors, filler and false starts. Step 5 fixes these in the source, never in this file.

```sh
git -C <clone> add interviews/<date>-<subject>.md
git -C <clone> commit -m "Interview: <subject>, <date>"
git -C <clone> push
git -C <clone> ls-remote origin refs/heads/main
git -C <clone> rev-parse HEAD
```

Done when the last two commands print the same commit, and nothing is written from the answers yet.

## 5. Write the draft source

When the answers add to an approved source, go to "A change to an approved source" below. Otherwise write the new draft source `knowledge/sources/<id>.md` from the raw answers, in the shape of SPEC-knowledge's "Sources":

- **Front matter:** the `id`, which is the file's name; a `title` of one line; `kind: interview`; the `subject`; `roles`, the role ids from `resume.yaml` that the answers are about (it may be empty); a `summary` of one line, at most 200 characters, written from the source; `links`, only exact public `https://` URLs that Peter gave, for side projects; `status: draft`; `approved:` empty; `source: Interview with Peter, <date>`. The id is a slug that no other source has (SPEC-knowledge, "Ids"). Citations name it once the source is approved, so it never changes after that.
- **Passages:** each `## ` heading is a question as asked, and its text is Peter's answer in the first person. Fix transcription errors and smooth filler and false starts. Keep his meaning and his words for what he did. A heading never says more than his answer: when the question said "lead" and he said "helped", the heading says "helped". A passage holds at most 3,000 characters. A longer answer goes on in the next passage, under the same heading with " (continued)" at its end.
- **Redaction:** take out each piece of material of a kind that is not public, such as a colleague's name or an internal link. `## Not public`, the last section, names each kind, and only the kind: it holds no URL, no IP address and no email address.
- **The redaction list:** write each removal to `interviews/<date>-<subject>-redactions.md` in the clone: the passage, what came out, its kind and what replaced it. Commit and push it as in step 4.

The draft source stays uncommitted until step 7. This repository is public, so a pushed draft source would publish text that Peter has not approved. Check it:

```sh
bun run knowledge --draft <id>
```

The command prints the source as the chat will read it once approved, then one line for each rule it breaks, `knowledge/sources/<id>.md: <rule>`, and exits with 1. A source with no broken rule ends on `"<id>" renders to <n> of 24,000 characters and breaks no rule of an approved source.` and exits with 0. Broken front matter or a broken section prints no text, only the problems. Fix those first: until then, `bun run knowledge` and `bun test` fail for every source.

Done when `bun run knowledge --draft <id>` exits with 0 and says the source breaks no rule, and the redaction list is on the private repo's remote: after its push, `git -C <clone> ls-remote origin refs/heads/main` and `git -C <clone> rev-parse HEAD` print the same commit.

## 6. Ask Peter to approve

Peter approves what visitors get, so he reads the source as the chat will read it before he answers.

1. In a chat message, give him the command `bun run knowledge --draft <id>` and the redaction list's path in the private repo. Ask him to say when he has read both.
2. Then ask through `ask-user-question:ask-user-question` whether he approves the source. Put in the question the source id, the title and the summary you wrote, each removal on the redaction list with its kind, and each smoothing edit that could change what he meant (SPEC-knowledge, Boundaries, "Ask first").

When he declines the source, delete the draft source and end here. The raw answers stay in the private repo.

Done when he approved, named changes, or declined; changes go back to step 5.

## 7. Approve, commit and release

1. Set `status: approved` and `approved:` to the date Peter approved.
2. Add a row to the decision record, the newest `docs/design/interview-<date>.md`: the source id, that date, and Peter's answer, quoted. The release skill's approval check lets a new approved source go only with this row.
3. Run the before-commit checks ([AGENTS.md](../../../AGENTS.md), "Verify"). The snapshots in `src/knowledge/__tests__/` then fail. Read the snapshot diff: it only adds lines for this source. Then run `bun test src/knowledge --update-snapshots` and `bun test` again.
4. Commit the source, the decision record and the snapshot file, each staged by name, as `feat(knowledge): the <id> source`.
5. The site build reads every approved source, so the push to `main` is a release. Push with the [release skill](../release/SKILL.md).

Done when the commit exists and the release skill has pushed it and given Peter its outcome.

## A change to an approved source

The edit rule (SPEC-knowledge, "Drafts and approval"; decision record row 130): a change to an approved source waits on a branch until Peter approves it in the question tool. The live source never changes unapproved.

1. Make the change on a new local branch from `main`. It stays off GitHub until Peter approves, for the reason in step 5.
2. New answers come from an interview that steps 1 to 4 saved. Passages are append-only: a new passage goes after the last one, before `## Not public`, and a correction keeps its passage in its place. A change never removes, moves, splits, merges or renumbers a passage. Each removal goes on a redaction list, as in step 5.
3. Run `bun test src/knowledge`. The snapshot of passage ids may only gain lines at the end of this source's list. Update the snapshots as in step 7.
4. Peter reads the change on its branch with `bun run knowledge <source id>`, and sees the snapshot diff and the redaction list. Then ask him through `ask-user-question:ask-user-question`, as in step 6.
5. On approval, set the new `approved:` date, add the decision record row as in step 7, and run the before-commit checks. Then merge the branch into `main` and push with the release skill. On a decline, the branch stays local and `main` keeps the approved source.

Done when the change is on `main` and the release skill has given Peter its outcome, or Peter declined and `main` holds the approved source unchanged.
