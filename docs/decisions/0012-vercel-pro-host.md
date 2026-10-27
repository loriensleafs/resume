# Host the site and chat on Vercel Pro, with the Bun runtime

Vercel runs TanStack Start with no configuration and runs its functions on the Bun runtime, so the server stays Bun ([0004](0004-bun-only.md)). It streams responses and has per-IP rate limiting. Peter chose the Pro plan ($20/month) over the free Hobby plan: it adds monthly usage credit, spend alerts, commercial-use terms and a free first-year domain. Peter signs up and pays; agents never buy or upgrade anything.

Decided 2026-10-26 by Peter.

Considered: Cloudflare Workers (not Bun, and its deploy tool needs Node.js); Railway (a Bun container at about $5/month, with rate limiting written into the app); Vercel Hobby (free, personal use only, no domain).

Evidence: [research 07](../research/07-tanstack-ai-hosting-model.md).
