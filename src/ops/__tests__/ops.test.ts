// Seam 2 of SPEC-deploy: the ops module through createOps(), against the in-test Upstash server and
// a fixed clock (Testing Strategy; decision record row 117).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { questionLogContract } from "../../chat/server/__tests__/question-log-contract";
import type { QuestionLogEntry } from "../../chat/server/question-log";
import type { ChatTurnEvent } from "../../chat/server/telemetry";
import { createOps } from "../ops";
import { startFakeUpstash, type FakeUpstash } from "./fake-upstash";

/** 2026-10-27 at noon UTC, the day the specs write their examples for. */
const noon = () => new Date("2026-10-27T12:00:00.000Z");

/** The question-log entry of an answered turn. */
const answeredEntry: QuestionLogEntry = {
  id: "entry-1",
  date: "2026-10-27",
  question: "How did FedNow's bundle get under 1 MB?",
  read: ["fednow-bundle-size"],
  citations: ["fednow-bundle-size.2"],
  removed: 0,
  outcome: "answered",
};

/** The chat_turn event of the same answered turn. */
const answeredTurn: ChatTurnEvent = {
  event: "chat_turn",
  outcome: "answered",
  reads: 1,
  citations: 1,
  removed: 0,
  modelCalls: 2,
  inputTokens: 1_200,
  cachedInputTokens: 9_000,
  cacheWriteTokens: 300,
  cacheWrite1hTokens: 0,
  outputTokens: 450,
  durationMs: 8_400,
  errorCode: null,
};

questionLogContract("createOps() outside production", (now) => createOps({ VERCEL_ENV: "preview" }, { now }).log);

describe("createOps() outside production", () => {
  test("the budget allows every turn, also 25 at once", async () => {
    const ops = createOps({ VERCEL_ENV: "preview" });

    const tickets = await Promise.all(Array.from({ length: 25 }, () => ops.budget.reserve()));

    expect(tickets).toEqual(Array.from({ length: 25 }, () => ({ ok: true, reservation: expect.any(String) })));
  });

  test.each([
    ["day", "DAILY_LIMIT"],
    ["month", "SPEND_LIMIT"],
  ] as const)("with PREVIEW_LIMIT=%s, the budget refuses every turn with %s", async (previewLimit, errorCode) => {
    const ops = createOps({ VERCEL_ENV: "preview", PREVIEW_LIMIT: previewLimit });

    expect(await ops.budget.reserve()).toEqual({ ok: false, errorCode });
    expect(await ops.budget.reserve()).toEqual({ ok: false, errorCode });
  });

  test("an empty PREVIEW_LIMIT counts as unset: the budget allows the turn", async () => {
    const ops = createOps({ VERCEL_ENV: "preview", PREVIEW_LIMIT: "" });

    expect(await ops.budget.reserve()).toEqual({ ok: true, reservation: expect.any(String) });
  });

  test("any other PREVIEW_LIMIT stops createOps() with an error that names the value", () => {
    expect(() => createOps({ VERCEL_ENV: "preview", PREVIEW_LIMIT: "daily" })).toThrow(
      'PREVIEW_LIMIT is "daily"; outside production it must be "day", "month" or unset.',
    );
  });

  test("the error shows at most 32 characters of an unknown PREVIEW_LIMIT", () => {
    const pasted = `${"k".repeat(32)}-the-rest-of-a-pasted-secret`;

    expect(() => createOps({ VERCEL_ENV: "preview", PREVIEW_LIMIT: pasted })).toThrow(
      `PREVIEW_LIMIT is "${"k".repeat(32)}" (cut to 32 characters); outside production it must be "day", "month" or unset.`,
    );
  });
});

describe("createOps() in production", () => {
  test("with no store or alert variables, a whole turn still works", async () => {
    const ops = createOps({ VERCEL_ENV: "production" }, { now: noon });

    const ticket = await ops.budget.reserve();
    if (!ticket.ok) throw new Error(`the budget refused the turn with ${ticket.errorCode}`);

    await expect(ops.log.append(answeredEntry)).resolves.toBeUndefined();
    await expect(ops.telemetry.record(answeredTurn, ticket.reservation)).resolves.toBeUndefined();
  });
});

describe("createOps() in production, on the in-test Upstash server", () => {
  let upstash: FakeUpstash | undefined;
  afterEach(async () => {
    await upstash?.stop();
    upstash = undefined;
  });

  // The suite gives each test its own clock; the store gets the same one, as in production.
  questionLogContract("the Upstash log", (now) => {
    upstash = startFakeUpstash({ now });
    return createOps(
      { VERCEL_ENV: "production", KV_REST_API_URL: upstash.url, KV_REST_API_TOKEN: upstash.token },
      { now },
    ).log;
  });
});

describe("createOps() with the store and alert variables set", () => {
  let upstash: FakeUpstash;
  beforeEach(() => {
    upstash = startFakeUpstash({ now: noon });
  });
  afterEach(async () => {
    await upstash.stop();
  });

  /** The variables production has, each pointing at the in-test server, so a store call or a push shows there. */
  const storeAndAlerts = () => ({
    KV_REST_API_URL: upstash.url,
    KV_REST_API_TOKEN: upstash.token,
    NTFY_TOPIC_URL: `${upstash.url}/topic`,
    ANTHROPIC_API_KEY: "test",
  });

  /** A production function instance on the in-test store, at noon on 2026-10-27. */
  const productionOps = () => createOps({ VERCEL_ENV: "production", ...storeAndAlerts() }, { now: noon });

  test("an entry that one function instance appends comes back from another instance's list(1)", async () => {
    await productionOps().log.append(answeredEntry);

    expect(await productionOps().log.list(1)).toEqual([answeredEntry]);
  });

  // Each expiry is counted by hand: 90 days after the day, at 00:00 UTC.
  test.each([
    ["2026-10-27", "2027-01-25T00:00:00.000Z"],
    ["2026-12-31", "2027-03-31T00:00:00.000Z"],
    ["2027-12-01", "2028-02-29T00:00:00.000Z"],
  ])("the key qlog:%s expires at %s, 00:00 UTC on the 90th day after its day", async (date, expiry) => {
    await productionOps().log.append({ ...answeredEntry, date });

    expect(upstash.expiresAt(`qlog:${date}`)).toEqual(new Date(expiry));
  });

  test("an append's commands arrive as one /multi-exec transaction that gives the day's key its expiry", async () => {
    await productionOps().log.append(answeredEntry);

    expect(upstash.requests.map((request) => request.path)).toEqual(["/multi-exec"]);
    const commands = JSON.parse(upstash.requests[0]!.body) as string[][];
    expect(commands.map(([name, key]) => [name, key])).toEqual([
      ["RPUSH", "qlog:2026-10-27"],
      ["EXPIREAT", "qlog:2026-10-27"],
    ]);
  });

  test("the store keeps only an entry's seven fields: a threadId passed with it never reaches the store", async () => {
    // The type keeps a threadId out, but an object with more fields still fits it at run time.
    const withThreadId: QuestionLogEntry = Object.assign({ threadId: "thread-of-one-visitor" }, answeredEntry);

    await productionOps().log.append(withThreadId);

    expect(upstash.requests[0]!.body).not.toContain("thread-of-one-visitor");
    expect(await productionOps().log.list(1)).toEqual([answeredEntry]);
  });

  test("list(365) reads only the 90 days the store keeps, with one /pipeline request of 90 commands", async () => {
    // At noon on 2026-10-27, the key of 2026-07-30 (89 days back) lives until 00:00 tomorrow, and the
    // key of 2026-07-29 (90 days back) expired at 00:00 today, so the store deletes it at once.
    const oldestKept: QuestionLogEntry = { ...answeredEntry, id: "entry-oldest-kept", date: "2026-07-30" };
    const expired: QuestionLogEntry = { ...answeredEntry, id: "entry-expired", date: "2026-07-29" };
    for (const entry of [expired, oldestKept, answeredEntry]) await productionOps().log.append(entry);
    const writes = upstash.requests.length;

    const entries = await productionOps().log.list(365);

    expect(entries).toEqual([answeredEntry, oldestKept]);
    const reads = upstash.requests.slice(writes);
    expect(reads.map((request) => [request.path, (JSON.parse(request.body) as unknown[]).length])).toEqual([["/pipeline", 90]]);
  });

  test("with a wrong token, append() rejects with the store's 401, and the error holds no question text or token", async () => {
    const ops = createOps(
      { VERCEL_ENV: "production", KV_REST_API_URL: upstash.url, KV_REST_API_TOKEN: "not-the-token" },
      { now: noon },
    );

    const error = await ops.log.append(answeredEntry).then(
      () => undefined,
      (refusal: unknown) => refusal,
    );

    expect(error).toMatchObject({ name: "UpstashError", code: "HTTP_401" });
    expect((error as Error).message).not.toContain(answeredEntry.question);
    expect((error as Error).message).not.toContain("not-the-token");
  });

  test("append() rejects when a command in its transaction fails, although the store answers 200", async () => {
    upstash.set("qlog:2026-10-27", "a string where the day's list belongs");

    await expect(productionOps().log.append(answeredEntry)).rejects.toMatchObject({ name: "UpstashError", code: "WRONGTYPE" });
  });

  test("list() rejects when the store cannot read a day", async () => {
    upstash.set("qlog:2026-10-26", "a string where the day's list belongs");

    await expect(productionOps().log.list(7)).rejects.toMatchObject({ name: "UpstashError", code: "WRONGTYPE" });
  });

  test.each(["27 October 2026", "2026-02-30", "2026-10-27T12:00:00.000Z", ""])(
    "an entry dated %p is refused and writes nothing, so no key lives without its expiry",
    async (date) => {
      await expect(productionOps().log.append({ ...answeredEntry, date })).rejects.toThrow("not a UTC day");

      expect(upstash.requests).toEqual([]);
    },
  );

  test("given io.fetch, every store call goes through it", async () => {
    const reached: string[] = [];
    // Bun's fetch type also carries preconnect(), which a plain function lacks.
    const recordingFetch = ((input: string | URL | Request, init?: RequestInit) => {
      reached.push(new URL(String(input)).pathname);
      return fetch(input, init);
    }) as typeof fetch;
    const ops = createOps({ VERCEL_ENV: "production", ...storeAndAlerts() }, { now: noon, fetch: recordingFetch });

    await ops.log.append(answeredEntry);
    await ops.log.list(1);

    expect(reached).toEqual(["/multi-exec", "/pipeline"]);
  });

  // The in-test server's address is http on 127.0.0.1, which every other test here uses: a loopback
  // request never leaves the machine, so the rule lets it through.
  test.each(["http://store.example", "ws://store.example", "store.example"])(
    "a store address %p that is not https gets no request, so the token never goes in clear text",
    async (url) => {
      const reached: string[] = [];
      // A store that answers every command, so only the address rule can stop the call.
      const answeringFetch = (async (input: string | URL | Request) => {
        reached.push(String(input));
        return Response.json([{ result: 1 }, { result: 1 }]);
      }) as unknown as typeof fetch;
      const ops = createOps(
        { VERCEL_ENV: "production", KV_REST_API_URL: url, KV_REST_API_TOKEN: upstash.token },
        { now: noon, fetch: answeringFetch },
      );

      await expect(ops.log.append(answeredEntry)).rejects.toMatchObject({ name: "UpstashError", code: "NOT_HTTPS" });
      await expect(ops.log.list(1)).rejects.toMatchObject({ name: "UpstashError", code: "NOT_HTTPS" });
      expect(reached).toEqual([]);
    },
  );

  test.each(["KV_REST_API_URL", "KV_REST_API_TOKEN"] as const)(
    "in production with %s missing, the log still keeps entries and calls no server",
    async (missing) => {
      const env = { VERCEL_ENV: "production", ...storeAndAlerts(), [missing]: undefined };
      const ops = createOps(env, { now: noon });

      await ops.log.append(answeredEntry);

      expect(await ops.log.list(1)).toEqual([answeredEntry]);
      expect(upstash.requests).toEqual([]);
    },
  );

  test.each(["day", "month", "daily"])("in production, PREVIEW_LIMIT=%s is ignored: the store's budget allows the turn", async (previewLimit) => {
    const ops = createOps({ VERCEL_ENV: "production", PREVIEW_LIMIT: previewLimit, ...storeAndAlerts() }, { now: noon });

    expect(await ops.budget.reserve()).toEqual({ ok: true, reservation: expect.any(String) });
    expect(upstash.requests.map((request) => request.path)).toEqual(["/multi-exec"]);
  });

  test.each(["preview", "development", undefined])("with VERCEL_ENV %p, a whole turn calls no server", async (vercelEnv) => {
    const ops = createOps({ VERCEL_ENV: vercelEnv, ...storeAndAlerts() }, { now: noon });

    const ticket = await ops.budget.reserve();
    if (!ticket.ok) throw new Error(`the budget refused the turn with ${ticket.errorCode}`);
    await ops.log.append(answeredEntry);
    await ops.telemetry.record(answeredTurn, ticket.reservation);
    await ops.log.list(7);

    expect(upstash.requests).toEqual([]);
  });
});

describe("the daily cap, in production on the in-test Upstash server", () => {
  // The function instances and the store share one clock, which a test can move to the next day.
  let clock: Date;
  let upstash: FakeUpstash;
  beforeEach(() => {
    clock = new Date("2026-10-27T12:00:00.000Z");
    upstash = startFakeUpstash({ now: () => clock });
  });
  afterEach(async () => {
    await upstash.stop();
  });

  /** A new production function instance on the in-test store. */
  const functionInstance = () =>
    createOps(
      { VERCEL_ENV: "production", KV_REST_API_URL: upstash.url, KV_REST_API_TOKEN: upstash.token },
      { now: () => clock },
    );

  test.each([
    ["one function instance", 1],
    ["25 function instances", 25],
  ])("25 parallel reserve() calls on an empty day, on %s: 8 succeed and 17 refuse with DAILY_LIMIT", async (_label, instances) => {
    const budgets = Array.from({ length: instances }, () => functionInstance().budget);

    const tickets = await Promise.all(Array.from({ length: 25 }, (_unused, call) => budgets[call % instances]!.reserve()));

    // 8 × $0.90 = $7.20; a ninth would make $8.10, which passes the $8 cap.
    expect(tickets.filter((ticket) => ticket.ok)).toHaveLength(8);
    expect(tickets.filter((ticket) => !ticket.ok)).toEqual(
      Array.from({ length: 17 }, () => ({ ok: false, errorCode: "DAILY_LIMIT" })),
    );
  });

  test("the 17 refusals take their $0.90 back: the day's cost in the store is $7.20", async () => {
    const budget = functionInstance().budget;

    await Promise.all(Array.from({ length: 25 }, () => budget.reserve()));

    // In millionths of a dollar: 8 × 900,000.
    expect(upstash.get("qcost:2026-10-27")).toBe("7200000");
  });

  test("each write of the daily cap is one /multi-exec transaction, and qcost:<day> expires at 00:00 UTC on the 90th day after its day", async () => {
    const budget = functionInstance().budget;

    // 8 reservations, then a refusal and its take-back: 10 writes.
    for (let turn = 0; turn < 9; turn++) await budget.reserve();

    expect(upstash.requests.map((request) => request.path)).toEqual(Array.from({ length: 10 }, () => "/multi-exec"));
    for (const request of upstash.requests) {
      const commands = JSON.parse(request.body) as string[][];
      expect(commands.map(([name, key]) => [name, key])).toEqual([
        ["INCRBY", "qcost:2026-10-27"],
        ["EXPIREAT", "qcost:2026-10-27"],
      ]);
    }
    // Counted by hand: 4 days to the end of October, 30 in November, 31 in December, 25 in January.
    expect(upstash.expiresAt("qcost:2026-10-27")).toEqual(new Date("2027-01-25T00:00:00.000Z"));
  });

  test("after the first refusal, the same function instance refuses later turns that day with no store call", async () => {
    const budget = functionInstance().budget;
    for (let turn = 0; turn < 8; turn++) await budget.reserve();
    expect(await budget.reserve()).toEqual({ ok: false, errorCode: "DAILY_LIMIT" });
    const storeCallsAtFirstRefusal = upstash.requests.length;

    clock = new Date("2026-10-27T23:59:59.999Z");

    expect(await budget.reserve()).toEqual({ ok: false, errorCode: "DAILY_LIMIT" });
    expect(await budget.reserve()).toEqual({ ok: false, errorCode: "DAILY_LIMIT" });
    expect(upstash.requests).toHaveLength(storeCallsAtFirstRefusal);
  });

  test("the next UTC day allows turns again, on that day's own cost", async () => {
    const budget = functionInstance().budget;
    for (let turn = 0; turn < 8; turn++) await budget.reserve();
    expect(await budget.reserve()).toEqual({ ok: false, errorCode: "DAILY_LIMIT" });

    clock = new Date("2026-10-28T00:00:00.000Z");

    expect(await budget.reserve()).toEqual({ ok: true, reservation: expect.any(String) });
    // $0.90 is 900,000 millionths of a dollar.
    expect(upstash.get("qcost:2026-10-28")).toBe("900000");
  });

  test("a refusal stands when the store fails to take its $0.90 back, and the $0.90 stays counted", async () => {
    // Other function instances have reserved 8 turns today.
    upstash.set("qcost:2026-10-27", "7200000");
    let storeCalls = 0;
    // The store takes the reservation, then answers 500 to the take-back.
    const failingAfterFirstCall = ((input: string | URL | Request, init?: RequestInit) =>
      ++storeCalls === 1 ? fetch(input, init) : Promise.resolve(Response.json({ error: "ERR" }, { status: 500 }))) as typeof fetch;
    const ops = createOps(
      { VERCEL_ENV: "production", KV_REST_API_URL: upstash.url, KV_REST_API_TOKEN: upstash.token },
      { now: () => clock, fetch: failingAfterFirstCall },
    );

    expect(await ops.budget.reserve()).toEqual({ ok: false, errorCode: "DAILY_LIMIT" });
    // An amount left counted errs toward pausing, as an unsettled reservation does.
    expect(upstash.get("qcost:2026-10-27")).toBe("8100000");
  });
});
