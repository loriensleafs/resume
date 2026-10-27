// PROTOTYPE (deploy spike): GET /api/spike reports which function answered and which Bun runs it (check 2).
// post-build.ts routes /api/spike to three functions (see vite.config.ts); SPIKE_FUNCTION comes from each
// function's .vc-config.json `environment`. The answer is a flat JSON object: names, versions and a path, no secret.
//
// D4 adds four modes, chosen by `?mode=`. They hold the KV_* variables (Production only), so check.ts needs no store
// secret, and they answer only on the protected hosts (spike-store.ts, onProtectedHost), so only a caller with the
// bypass secret reaches them; the production address is public. Each answers a flat JSON object of booleans,
// numbers, hosts and error words, never a token or a store value it did not write itself.
// - mode=store (check 9): the key table's writes and the reservation through /multi-exec with EXPIREAT, then the
//   reader's commands (LRANGE, HGETALL, ZRANGE, GET) with the read-only token, and a write with it as a control.
// - mode=stream&kind=turn|after-close|after-close-wait&id=<uuid> (check 7): a server-sent-event stream. "turn" is
//   SPEC-deploy's turn: one write before the stream (the reservation's place), then 40 chunks 250 ms apart, which a
//   stop ends early, then after the last chunk two writes (log.append() and telemetry.record()), 2 s apart, then
//   the end of the stream. "after-close" writes 2 s after the stream has ended, with no waitUntil; "after-close-wait"
//   does the same inside Vercel's waitUntil, which Nitro's Vercel entry puts on the request (request.waitUntil).
//   Each write is a marker key spike:stream:<id>:<name> that expires after 15 minutes.
// - mode=report-stream&ids=<uuid>,... (check 7): each marker's age in ms (from PTTL, the store's own clock) and the
//   facts the turn wrote into it, so check.ts can tell when each write landed.
// - mode=report-cron&schedule=<probe>&spec=<schedule> (check 6): what spike:cron:calls holds about the calls that
//   reached /api/cron/health.
import { createFileRoute } from '@tanstack/react-router'
import {
  allOk,
  type Command,
  command,
  CRON_CALLS_KEY,
  multiExec,
  type Outcome,
  onProtectedHost,
  pipeline,
  requestHosts,
  storeConfig,
} from '../spike-store'

type Flat = Record<string, boolean | string | number | null>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SCHEDULE = /^[0-9*/ ,-]{1,40}$/
const MARK_MS = 15 * 60_000 // a stream marker's expiry
const MARKERS = ['start', 'append', 'record', 'afterClose'] as const

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const json = (body: Flat, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

/** The status, and the error word when the call failed as a whole. */
const outcome = (prefix: string, o: Outcome): Flat => ({ [`${prefix}.status`]: o.status, [`${prefix}.error`]: o.error ?? null })
/** One reply's error word, or null. */
const replyError = (o: Outcome, i: number) => o.error ?? o.replies[i]?.error ?? null
const result = (o: Outcome, i: number) => o.replies[i]?.result
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Check 9: what the standard token and the read-only token can run, on fresh spike:tokens:<nonce>:* keys. */
async function storeCheck(): Promise<Flat> {
  const nonce = crypto.randomUUID()
  const key = (name: string) => `spike:tokens:${nonce}:${name}`
  const expireAt = Math.floor(Date.now() / 1000) + 600 // EXPIREAT, as the key table's "00:00 UTC on the 90th day"
  const out: Flat = {}
  for (const [name, set] of Object.entries(storeConfig())) out[`config.${name}`] = set

  // 1. The key table's writes, each key with its expiry in the same transaction: a list (qlog), a hash (qstats)
  //    and a sorted set with one member that ZADD GT only raises (qslow).
  const write = await multiExec('standard', [
    ['RPUSH', key('qlog'), '{"entry":1}'],
    ['EXPIREAT', key('qlog'), expireAt],
    ['HINCRBY', key('qstats'), 'answered', 1],
    ['EXPIREAT', key('qstats'), expireAt],
    ['ZADD', key('qslow'), 'GT', 1234, 'longest'],
    ['ZADD', key('qslow'), 'GT', 999, 'longest'],
    ['EXPIREAT', key('qslow'), expireAt],
  ])
  Object.assign(out, outcome('write', write))
  out['write.ok'] = allOk(write, 7)
  out['write.expireat'] = same([result(write, 1), result(write, 3), result(write, 6)], [1, 1, 1])
  out['write.zaddGt'] = same([result(write, 4), result(write, 5)], [1, 0]) // the lower score left the member alone

  // 2. The reservation (SPEC-deploy, "The daily cap", step 1): add $0.90 to the day's total and read the spend-limit
  //    marker, with the day's expiry, in one transaction; PTTL shows the expiry took.
  const reserve = await multiExec('standard', [
    ['INCRBY', key('qcost'), 900_000],
    ['EXPIREAT', key('qcost'), expireAt],
    ['GET', key('limit')],
    ['PTTL', key('qcost')],
  ])
  Object.assign(out, outcome('reserve', reserve))
  out['reserve.ok'] = allOk(reserve, 4)
  out['reserve.total'] = (result(reserve, 0) as number | undefined) ?? null
  out['reserve.expireat'] = (result(reserve, 1) as number | undefined) ?? null
  out['reserve.limitMarker'] = result(reserve, 2) === null ? 'none' : 'set'
  out['reserve.ttlMs'] = (result(reserve, 3) as number | undefined) ?? null

  // 3. The reader's commands with the read-only token, one by one and as a pipeline. Each must give what step 1 wrote.
  const reads: [string, Command, unknown][] = [
    ['lrange', ['LRANGE', key('qlog'), 0, -1], ['{"entry":1}']],
    ['hgetall', ['HGETALL', key('qstats')], ['answered', '1']],
    ['zrange', ['ZRANGE', key('qslow'), 0, -1, 'WITHSCORES'], ['longest', '1234']],
    ['get', ['GET', key('qcost')], '900000'],
  ]
  for (const [name, cmd, want] of reads) {
    const r = await command('readOnly', cmd)
    out[`ro.${name}.status`] = r.status
    out[`ro.${name}.error`] = replyError(r, 0)
    out[`ro.${name}.same`] = r.status === 200 && same(result(r, 0), want)
  }
  const roPipeline = await pipeline('readOnly', reads.map(([, cmd]) => cmd))
  Object.assign(out, outcome('ro.pipeline', roPipeline))
  out['ro.pipeline.same'] = allOk(roPipeline, reads.length) && reads.every(([, , want], i) => same(result(roPipeline, i), want))
  const roMulti = await multiExec('readOnly', [reads[0]![1], reads[3]![1]])
  Object.assign(out, outcome('ro.multiExec', roMulti))
  out['ro.multiExec.same'] = allOk(roMulti, 2) && same(result(roMulti, 0), reads[0]![2]) && same(result(roMulti, 1), reads[3]![2])

  // 4. Controls: the read-only token must not write. A refused SET leaves no key; a refused EXPIREAT leaves the
  //    expiry as step 1 set it. SCAN is a read that Upstash's docs say the read-only token cannot run.
  const roSet = await command('readOnly', ['SET', key('ro'), 'x', 'EX', 60])
  out['ro.set.status'] = roSet.status
  out['ro.set.error'] = replyError(roSet, 0)
  const roExpire = await command('readOnly', ['EXPIREAT', key('qlog'), expireAt + 3600])
  out['ro.expireat.status'] = roExpire.status
  out['ro.expireat.error'] = replyError(roExpire, 0)
  const roScan = await command('readOnly', ['SCAN', 0, 'MATCH', `spike:tokens:${nonce}:*`, 'COUNT', 10])
  out['ro.scan.status'] = roScan.status
  out['ro.scan.error'] = replyError(roScan, 0)
  const after = await pipeline('standard', [['EXISTS', key('ro')], ['PTTL', key('qlog')]])
  out['ro.set.keyExists'] = (result(after, 0) as number | undefined) ?? null
  out['ro.expireat.ttlKept'] = typeof result(after, 1) === 'number' && (result(after, 1) as number) <= 600_000

  // 5. The take-back (step 2 of the daily cap): the total returns to 0 and keeps its expiry.
  const takeBack = await multiExec('standard', [['DECRBY', key('qcost'), 900_000], ['PTTL', key('qcost')]])
  Object.assign(out, outcome('takeBack', takeBack))
  out['takeBack.total'] = (result(takeBack, 0) as number | undefined) ?? null
  out['takeBack.ttlKept'] = typeof result(takeBack, 1) === 'number' && (result(takeBack, 1) as number) > 0

  // 6. Clean up: the keys would expire in 10 minutes anyway.
  const names = ['qlog', 'qstats', 'qslow', 'qcost', 'limit', 'ro']
  const cleanup = await command('standard', ['DEL', ...names.map(key)])
  out['cleanup.deleted'] = (result(cleanup, 0) as number | undefined) ?? null
  return out
}

/**
 * Check 7: a server-sent-event stream that writes markers. The client stops a "turn" by aborting its fetch; the
 * function sees that as request.signal's abort, the stream's cancel, or a failed enqueue, whichever comes first.
 */
async function stream(request: Request, kind: 'turn' | 'after-close' | 'after-close-wait', id: string): Promise<Response> {
  const key = (name: string) => `spike:stream:${id}:${name}`
  const mark = (name: (typeof MARKERS)[number], value: Flat) =>
    multiExec('standard', [['PSETEX', key(name), MARK_MS, JSON.stringify(value)]])
  const waitUntil = (request as Request & { waitUntil?: (promise: Promise<unknown>) => void }).waitUntil
  const state: { ended: 'abort' | 'cancel' | 'enqueue' | null } = { ended: null }
  request.signal.addEventListener('abort', () => void (state.ended ??= 'abort'), { once: true })

  // after-close-wait: the write after the stream's end runs inside Vercel's waitUntil, registered while the request lives.
  let settled = () => {}
  let registered = false
  if (kind === 'after-close-wait' && typeof waitUntil === 'function') {
    try {
      waitUntil.call(request, new Promise<void>((resolve) => (settled = resolve)))
      registered = true
    } catch {
      registered = false
    }
  }

  // Before the stream, where SPEC-deploy's turn makes its reservation.
  await mark('start', { kind, waitUntil: typeof waitUntil === 'function' })

  const encoder = new TextEncoder()
  const run = async (controller: ReadableStreamDefaultController<Uint8Array>) => {
    const max = kind === 'turn' ? 40 : 4
    let chunks = 0
    while (state.ended === null && chunks < max) {
      try {
        controller.enqueue(encoder.encode(`data: {"chunk":${chunks}}\n\n`))
      } catch {
        state.ended = 'enqueue'
        break
      }
      chunks++
      await sleep(250)
    }
    const ended = state.ended ?? 'end'
    if (kind === 'turn') {
      // After the last chunk: log.append(), then telemetry.record(), one transaction each. The 2 s between them
      // stand for a slow settle, so the second write shows whether the function still runs well after a stop.
      await mark('append', { ended, chunks, signalAborted: request.signal.aborted })
      await sleep(2_000)
      await mark('record', { ended, chunks })
      try {
        controller.enqueue(encoder.encode('data: {"done":true}\n\n'))
        controller.close()
      } catch {
        // the client is gone
      }
      return
    }
    try {
      controller.close()
    } catch {
      // the client is gone
    }
    await sleep(2_000)
    await mark('afterClose', { ended, chunks, registered })
    settled()
  }

  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        void run(controller)
      },
      cancel() {
        state.ended ??= 'cancel'
      },
    }),
    { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store' } },
  )
}

/** Check 7's report: per stream id (in the order given, as s0, s1, ...) each marker's age and the facts it holds. */
async function streamReport(ids: string[]): Promise<Flat> {
  const cmds: Command[] = ids.flatMap((id) => MARKERS.flatMap((m) => [['GET', `spike:stream:${id}:${m}`], ['PTTL', `spike:stream:${id}:${m}`]]))
  const read = await pipeline('standard', cmds)
  const out: Flat = { ...outcome('read', read) }
  ids.forEach((_, i) => {
    MARKERS.forEach((m, j) => {
      const at = (i * MARKERS.length + j) * 2
      const pttl = result(read, at + 1)
      out[`s${i}.${m}.ageMs`] = typeof pttl === 'number' && pttl > 0 ? MARK_MS - pttl : null
      const value = result(read, at)
      if (typeof value !== 'string') return
      try {
        for (const [field, v] of Object.entries(JSON.parse(value) as Flat)) out[`s${i}.${m}.${field}`] = v
      } catch {
        out[`s${i}.${m}.unreadable`] = true
      }
    })
  })
  return out
}

/** Check 6's report: the calls in spike:cron:calls (newest first), grouped by who sent them. */
async function cronReport(probe: string, spec: string): Promise<Flat> {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? null
  const read = await command('standard', ['LRANGE', CRON_CALLS_KEY, 0, -1])
  const entries = ((result(read, 0) as string[] | undefined) ?? []).flatMap((line) => {
    try {
      return [JSON.parse(line) as Flat]
    } catch {
      return []
    }
  })
  const out: Flat = { ...outcome('read', read), calls: entries.length, cronSecretSet: Boolean(process.env.CRON_SECRET) }
  const groups: [string, (e: Flat) => boolean][] = [
    ['probe', (e) => e.cronAgent === true && e.schedule === probe],
    ['spec', (e) => e.cronAgent === true && e.schedule === spec],
    ['cronOther', (e) => e.cronAgent === true && e.schedule !== probe && e.schedule !== spec],
    ['plain', (e) => e.cronAgent !== true],
  ]
  for (const [name, test] of groups) {
    const group = entries.filter(test)
    out[`${name}.calls`] = group.length
    const last = group[0]
    if (!last) continue
    for (const field of ['at', 'host', 'forwardedHost', 'urlHost', 'path', 'schedule', 'authorization', 'cronSecretSet', 'function', 'vercelEnv', 'region']) {
      out[`${name}.${field}`] = last[field] ?? null
    }
    out[`${name}.commit`] = typeof last.commit === 'string' ? last.commit.slice(0, 7) : null
    out[`${name}.thisCommit`] = last.commit === commit
  }
  return out
}

export const Route = createFileRoute('/api/spike')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const mode = url.searchParams.get('mode')
        if (mode === null) {
          return json({
            function: process.env.SPIKE_FUNCTION ?? null,
            bunVersion: Bun.version,
            bunRevision: Bun.revision,
            path: url.pathname, // the path the function saw, after Vercel's rewrite
            region: process.env.VERCEL_REGION ?? null,
            vercelEnv: process.env.VERCEL_ENV ?? null,
          })
        }
        if (!onProtectedHost(request)) return json({ refused: true, ...requestHosts(request) }, 403)
        if (mode === 'store') return json(await storeCheck())
        if (mode === 'stream') {
          const kind = url.searchParams.get('kind')
          const id = url.searchParams.get('id') ?? ''
          if ((kind === 'turn' || kind === 'after-close' || kind === 'after-close-wait') && UUID.test(id)) return stream(request, kind, id)
        }
        if (mode === 'report-stream') {
          const ids = (url.searchParams.get('ids') ?? '').split(',')
          if (ids.length >= 1 && ids.length <= 4 && ids.every((id) => UUID.test(id))) return json(await streamReport(ids))
        }
        if (mode === 'report-cron') {
          const probe = url.searchParams.get('schedule') ?? ''
          const spec = url.searchParams.get('spec') ?? ''
          if (SCHEDULE.test(probe) && SCHEDULE.test(spec)) return json(await cronReport(probe, spec))
        }
        return json({ error: 'bad_request' }, 400)
      },
    },
  },
})
