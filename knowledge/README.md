# Knowledge

What the resume chat may answer from, besides `resume.yaml`. The rules are in [SPEC-knowledge](../spec/SPEC-knowledge.md).

- `sources/<source id>.md`: the source files, approved or draft. Each is a deep dive or an interview. A deep dive explains one highlight or project in the third person, written from Peter's answers. The nine deep dives are approved sources here; they moved from the old `deep-dives/` folder. An interview holds Peter's answers in his own words, each under the question asked. Each `## ` section is a passage, numbered from 1 in file order. The last section, `## Not public`, names the kinds of material the chat declines to describe.
- `logistics.yaml`: Peter's logistics answers about remote work, location, availability and target roles.

A source file or a logistics answer reaches the chat only after Peter approves it: `status: approved` plus the date he approved it. Until then it is a draft (`status: draft`), and the build checks only its front matter and its sections.

Three commands show what the chat reads:

```sh
bun run knowledge                       # the core, sent with every question, then its size and each approved source's size
bun run knowledge <id> [<id> ...]       # approved sources or passages as one read of the chat gives them
bun run knowledge --draft <source id>   # a draft as the chat will read it once approved, then each rule it breaks
```

A source id reads all its passages, and a passage id (`<source id>.<n>`) reads one. The text goes to standard output, and everything else to standard error. An unknown or skipped id, or a broken rule, exits with 1.
