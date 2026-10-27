// PROTOTYPE (deploy spike): GET /api/spike reports which function answered and which Bun runs it (check 2).
// post-build.ts routes /api/spike to three functions (see vite.config.ts); SPIKE_FUNCTION comes from each
// function's .vc-config.json `environment`. The answer is a flat JSON object: names, versions and a path, no secret.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/spike')({
  server: {
    handlers: {
      GET: ({ request }) =>
        Response.json(
          {
            function: process.env.SPIKE_FUNCTION ?? null,
            bunVersion: Bun.version,
            bunRevision: Bun.revision,
            path: new URL(request.url).pathname, // the path the function saw, after Vercel's rewrite
            region: process.env.VERCEL_REGION ?? null,
            vercelEnv: process.env.VERCEL_ENV ?? null,
          },
          { headers: { 'cache-control': 'no-store' } },
        ),
    },
  },
})
