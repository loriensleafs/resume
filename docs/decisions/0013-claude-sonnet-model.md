# The chat starts on Claude Sonnet 5.5

The chat uses Claude Sonnet 5.5 through TanStack AI's Anthropic adapter and Peter's own Anthropic API key. Peter chose it over Claude Haiku 5.5 for stronger answers and better resistance to trick questions, at about $5–$10 per 1,000 questions against about $0.30–$2 for Haiku.

Decided 2026-10-26 by Peter.

Consequences:

- Changing the model is a one-line change. The trick-question evals run against whichever model is configured.
- Claude 5-generation models reject sampling settings such as `temperature`, so answers stay grounded through the knowledge file, the system prompt and the evals.
- Spend stays bounded by a monthly workspace spend limit in the Anthropic Console, Vercel's per-IP rate limit, a cap on answer length, and Vercel Pro's spend alerts.

Evidence: [research 07](../research/07-tanstack-ai-hosting-model.md).
