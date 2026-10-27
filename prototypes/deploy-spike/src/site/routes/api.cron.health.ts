// PROTOTYPE (deploy spike, D4, check 6): the route that Vercel Cron calls. post-build.ts sends /api/cron/health
// to /__server after the filesystem phase, case-sensitive, as SPEC-deploy's routes do, and writes two crons for it:
// SPEC-deploy's "17 15 * * *" and a probe a few minutes after the build, so a run can see a call.
// Vercel Cron sends a GET with the user agent vercel-cron/1.0 and the x-vercel-cron-schedule header, and with
// `Authorization: Bearer $CRON_SECRET` when the project sets CRON_SECRET (https://vercel.com/docs/cron-jobs).
// Each call is recorded in the store list spike:cron:calls (the newest 50, kept 7 days): when, which hosts it
// named, whether it came from Vercel Cron, which schedule, whether it carried CRON_SECRET (a word, never the value),
// and which function and commit answered. /api/spike?report=cron reads the list for check 6.
// Unlike SPEC-deploy's route, it records every call, also one without the secret: what reaches it is the question.
// It answers 200 { recorded, function }, or 500 { recorded: false, error } when the store write fails.
import { createFileRoute } from '@tanstack/react-router'
import { timingSafeEqual } from 'node:crypto'
import { allOk, CRON_CALLS_KEY, multiExec, requestHosts, safeText } from '../spike-store'

/** "secret" when the header is exactly `Bearer $CRON_SECRET`, "absent" without the header, else "other". */
function authorization(header: string | null): 'secret' | 'absent' | 'other' {
  if (header === null) return 'absent'
  const secret = process.env.CRON_SECRET
  if (!secret) return 'other'
  const want = Buffer.from(`Bearer ${secret}`)
  const got = Buffer.from(header)
  return got.length === want.length && timingSafeEqual(got, want) ? 'secret' : 'other'
}

export const Route = createFileRoute('/api/cron/health')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const record = {
          at: new Date().toISOString(),
          ...requestHosts(request),
          path: new URL(request.url).pathname,
          cronAgent: (request.headers.get('user-agent') ?? '').startsWith('vercel-cron/'),
          schedule: safeText(request.headers.get('x-vercel-cron-schedule'), 40),
          authorization: authorization(request.headers.get('authorization')),
          cronSecretSet: Boolean(process.env.CRON_SECRET),
          function: process.env.SPIKE_FUNCTION ?? null,
          commit: safeText(process.env.VERCEL_GIT_COMMIT_SHA ?? null, 40),
          vercelEnv: process.env.VERCEL_ENV ?? null,
          region: process.env.VERCEL_REGION ?? null,
        }
        const write = await multiExec('standard', [
          ['LPUSH', CRON_CALLS_KEY, JSON.stringify(record)],
          ['LTRIM', CRON_CALLS_KEY, 0, 49],
          ['EXPIRE', CRON_CALLS_KEY, 7 * 24 * 3600],
        ])
        const recorded = allOk(write, 3)
        return Response.json(
          recorded ? { recorded, function: record.function } : { recorded, function: record.function, error: write.error ?? `HTTP ${write.status}` },
          { status: recorded ? 200 : 500, headers: { 'cache-control': 'no-store' } },
        )
      },
    },
  },
})
