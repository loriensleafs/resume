# The question log lives in Upstash Redis, pay as you go, with one list per day that expires

Decision [0020](0020-anonymous-question-log.md) left the store to SPEC-deploy. The question log gets a few thousand entries a month at most, each under 12 KB, and every entry must be deleted after 90 days. Peter chose Upstash Redis from the Vercel Marketplace, on the pay-as-you-go plan with a $1 monthly budget.

Decided 2026-10-27 by Peter ([interview record](../design/interview-2026-10-26.md), row 109).

- Entries for one day go into one list, `qlog:<date>`. Each write sets the list to expire 90 days after its day, so Redis deletes old entries by itself: no scheduled job.
- The chat function writes through Upstash's REST API with plain `fetch`, so no package is added. `bun run questions` reads with the read-only token, which cannot write or delete.
- Pay as you go costs $0.20 per 100,000 commands, a few cents a month here. At the $1 budget the database slows down instead of billing more. Billing goes through Peter's Vercel account.

Considered:

- Upstash free tier: $0, but a free database is archived after at least 30 days with no use, so a quiet month would stop the log until Peter restored it by hand.
- Neon Postgres, free: no expiry, so a daily cron job and a database driver or TCP client would do the deletion.
- Vercel Blob: no expiry, and its SDK would be a new package.

Evidence: [research 12](../research/12-deploy-platform.md).
