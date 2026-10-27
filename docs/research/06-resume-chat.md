# A public resume site with an AI chat

Researched 2026-10-26.

- No source found shows that a resume chatbot raises callback rates. Screeners scan a resume briefly; a portfolio or demo matters later, once someone takes a closer look. A live demo turns doubt into belief faster than a claim in a PDF, but demos break when APIs or free tiers change, so keep a short recording as a fallback. (FACE Prep, 2026; it cites no data for the demo claims.) https://faceprep.in/article/ai-project-portfolio-vs-resume-tradeoff-2026/
- Hiring software does not follow links in a resume (Jobscan, cited by FACE Prep), so the site helps human readers, not the screen.
- GitHub Pages is free for public repositories; for private repositories it needs GitHub Pro, Team or Enterprise. A Pages site is public even when its repository is private. https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- Risks of a public chat: it can state a wrong fact (titles and dates are what background checks verify); visitors try to make it say embarrassing things; it needs a server-side API key, a rate limit and a spend cap.

Outcome: build the chat as a work sample of AI platform engineering, grounded in an approved knowledge file, with refusals and a trick-question eval suite ([decisions 0008](../decisions/0008-grounded-knowledge-file.md) and [0009](../decisions/0009-chat-scope.md)).
