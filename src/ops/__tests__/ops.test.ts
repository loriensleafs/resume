// Seam 2 of SPEC-deploy: the ops module through createOps(), against the in-test Upstash server and
// a fixed clock (Testing Strategy; decision record row 117).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { questionLogContract } from "../../chat/server/__tests__/question-log-contract";
import type { QuestionLogEntry } from "../../chat/server/question-log";
import type { ChatTurnEvent } from "../../chat/server/telemetry";
import { createOps } from "../ops";
import { startFakeNtfy, type FakeNtfy } from "./fake-ntfy";
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

/** A turn whose model calls all finished, with every kind of token, for the worked example of the cost estimate. */
const workedExampleTurn: ChatTurnEvent = {
  event: "chat_turn",
  outcome: "answered",
  reads: 2,
  citations: 3,
  removed: 0,
  modelCalls: 3,
  inputTokens: 3_000,
  cachedInputTokens: 40_005,
  cacheWriteTokens: 12_000,
  cacheWrite1hTokens: 2_000,
  outputTokens: 1_500,
  durationMs: 21_000,
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
  test("with no store or alert variables, a whole turn still works, and its chat_turn line is printed", async () => {
    const printed: string[] = [];
    const ops = createOps({ VERCEL_ENV: "production" }, { now: noon, print: (line) => printed.push(line) });

    const ticket = await ops.budget.reserve();
    if (!ticket.ok) throw new Error(`the budget refused the turn with ${ticket.errorCode}`);

    await expect(ops.log.append(answeredEntry)).resolves.toBeUndefined();
    await expect(ops.telemetry.record(answeredTurn, ticket.reservation)).resolves.toBeUndefined();
    expect(printed.map((line) => JSON.parse(line) as unknown)).toEqual([
      { event: "ops_error", step: "config", code: "missing_config", missing: ["KV_REST_API_URL", "KV_REST_API_TOKEN", "NTFY_TOPIC_URL"] },
      answeredTurn,
    ]);
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
  let printed: string[];
  beforeEach(() => {
    upstash = startFakeUpstash({ now: noon });
    printed = [];
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

  /** A production function instance on the in-test store, at noon on 2026-10-27, whose function log is `printed`. */
  const productionOps = () =>
    createOps({ VERCEL_ENV: "production", ...storeAndAlerts() }, { now: noon, print: (line) => printed.push(line) });

  /** The lines in the function log, as JSON. */
  const printedLines = () => printed.map((line) => JSON.parse(line) as unknown);

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

  test("with a wrong token, append() resolves and prints an ops_error line with the store's 401, and no line holds question text or the token", async () => {
    const ops = createOps(
      { VERCEL_ENV: "production", KV_REST_API_URL: upstash.url, KV_REST_API_TOKEN: "not-the-token" },
      { now: noon, print: (line) => printed.push(line) },
    );

    await expect(ops.log.append(answeredEntry)).resolves.toBeUndefined();

    expect(printedLines()).toContainEqual({ event: "ops_error", step: "append", code: "HTTP_401" });
    expect(printed.join("\n")).not.toContain(answeredEntry.question);
    expect(printed.join("\n")).not.toContain("not-the-token");
  });

  test("append() resolves and prints an ops_error line when a command in its transaction fails, although the store answers 200", async () => {
    upstash.set("qlog:2026-10-27", "a string where the day's list belongs");

    await expect(productionOps().log.append(answeredEntry)).resolves.toBeUndefined();

    expect(printedLines()).toContainEqual({ event: "ops_error", step: "append", code: "WRONGTYPE" });
  });

  test("list() rejects when the store cannot read a day", async () => {
    upstash.set("qlog:2026-10-26", "a string where the day's list belongs");

    await expect(productionOps().log.list(7)).rejects.toMatchObject({ name: "UpstashError", code: "WRONGTYPE" });
  });

  test.each(["27 October 2026", "2026-02-30", "2026-10-27T12:00:00.000Z", ""])(
    "an entry dated %p is refused with an ops_error line and writes nothing, so no key lives without its expiry",
    async (date) => {
      await expect(productionOps().log.append({ ...answeredEntry, date })).resolves.toBeUndefined();

      expect(printedLines()).toEqual([{ event: "ops_error", step: "append", code: "RangeError" }]);
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
    "a store address %p that is not https gets no request, so the token never goes in clear text, and append() prints NOT_HTTPS",
    async (url) => {
      const reached: string[] = [];
      // A store that answers every command, so only the address rule can stop the call.
      const answeringFetch = (async (input: string | URL | Request) => {
        reached.push(String(input));
        return Response.json([{ result: 1 }, { result: 1 }]);
      }) as unknown as typeof fetch;
      const ops = createOps(
        { VERCEL_ENV: "production", KV_REST_API_URL: url, KV_REST_API_TOKEN: upstash.token },
        { now: noon, fetch: answeringFetch, print: (line) => printed.push(line) },
      );

      await expect(ops.log.append(answeredEntry)).resolves.toBeUndefined();
      expect(printedLines()).toContainEqual({ event: "ops_error", step: "append", code: "NOT_HTTPS" });
      // A read for Peter is not part of an answer, so it still rejects.
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

  test.each(["KV_REST_API_URL", "KV_REST_API_TOKEN", "NTFY_TOPIC_URL"] as const)(
    "in production with %s missing, every turn prints an ops_error line with missing_config that names it, and the turn still goes through",
    async (missing) => {
      const env = { VERCEL_ENV: "production", ...storeAndAlerts(), [missing]: undefined };
      const ops = createOps(env, { now: noon, print: (line) => printed.push(line) });

      for (let turn = 0; turn < 2; turn++) {
        const ticket = await ops.budget.reserve();
        if (!ticket.ok) throw new Error(`the budget refused the turn with ${ticket.errorCode}`);
        await ops.telemetry.record(answeredTurn, ticket.reservation);
        await ops.log.append(answeredEntry);
      }

      expect(printedLines().filter((line) => (line as { event: string }).event === "ops_error")).toEqual([
        { event: "ops_error", step: "config", code: "missing_config", missing: [missing] },
        { event: "ops_error", step: "config", code: "missing_config", missing: [missing] },
      ]);
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
    // Only the store keeps daily totals.
    expect(await ops.totals(7)).toEqual([]);

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

  test("each write of the daily cap is one /multi-exec transaction, a reservation's reads limit:spend too, and qcost:<day> expires at 00:00 UTC on the 90th day after its day", async () => {
    const budget = functionInstance().budget;

    // 9 reservations, the ninth refused, then its take-back: 10 writes.
    for (let turn = 0; turn < 9; turn++) await budget.reserve();

    expect(upstash.requests.map((request) => request.path)).toEqual(Array.from({ length: 10 }, () => "/multi-exec"));
    const reservation = [
      ["INCRBY", "qcost:2026-10-27"],
      ["EXPIREAT", "qcost:2026-10-27"],
      ["GET", "limit:spend"],
    ];
    const takeBack = reservation.slice(0, 2);
    expect(upstash.requests.map((request) => (JSON.parse(request.body) as string[][]).map(([name, key]) => [name, key]))).toEqual([
      ...Array.from({ length: 9 }, () => reservation),
      takeBack,
    ]);
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

  test("a refusal stands when the store fails to take its $0.90 back, the $0.90 stays counted, and the take-back prints its ops_error line", async () => {
    // Other function instances have reserved 8 turns today.
    upstash.set("qcost:2026-10-27", "7200000");
    let storeCalls = 0;
    // The store takes the reservation, then answers 500 to the take-back.
    const failingAfterFirstCall = ((input: string | URL | Request, init?: RequestInit) =>
      ++storeCalls === 1 ? fetch(input, init) : Promise.resolve(Response.json({ error: "ERR" }, { status: 500 }))) as typeof fetch;
    const printed: string[] = [];
    const ops = createOps(
      { VERCEL_ENV: "production", KV_REST_API_URL: upstash.url, KV_REST_API_TOKEN: upstash.token },
      { now: () => clock, fetch: failingAfterFirstCall, print: (line) => printed.push(line) },
    );

    expect(await ops.budget.reserve()).toEqual({ ok: false, errorCode: "DAILY_LIMIT" });
    // An amount left counted errs toward pausing, as an unsettled reservation does.
    expect(upstash.get("qcost:2026-10-27")).toBe("8100000");
    expect(printed.map((line) => JSON.parse(line) as unknown)).toContainEqual({ event: "ops_error", step: "take_back", code: "HTTP_500" });
  });
});

describe("the telemetry and the daily totals, in production on the in-test Upstash server", () => {
  // The function instances and the store share one clock, which a test can move to another day.
  let clock: Date;
  let upstash: FakeUpstash;
  let printed: string[];
  beforeEach(() => {
    clock = new Date("2026-10-27T12:00:00.000Z");
    upstash = startFakeUpstash({ now: () => clock });
    printed = [];
  });
  afterEach(async () => {
    await upstash.stop();
  });

  /** A new production function instance on the in-test store, whose function log is `printed`. */
  const functionInstance = () =>
    createOps(
      { VERCEL_ENV: "production", KV_REST_API_URL: upstash.url, KV_REST_API_TOKEN: upstash.token },
      { now: () => clock, print: (line) => printed.push(line) },
    );

  /** Reserves a turn on the instance, as the handler does before its first model call. */
  const reserveOn = async (ops: ReturnType<typeof createOps>) => {
    const ticket = await ops.budget.reserve();
    if (!ticket.ok) throw new Error(`the budget refused the turn with ${ticket.errorCode}`);
    return ticket.reservation;
  };

  test("record() prints the chat_turn line, with the event's fields only: a threadId passed with it reaches neither the line nor the store", async () => {
    const ops = functionInstance();
    const reservation = await reserveOn(ops);
    // The type keeps a threadId out, but an object with more fields still fits it at run time.
    const withThreadId: ChatTurnEvent = Object.assign({ threadId: "thread-of-one-visitor" }, answeredTurn);

    await ops.telemetry.record(withThreadId, reservation);

    // These instances have no NTFY_TOPIC_URL, so the log also holds the turn's missing_config line.
    const lines = printed.map((line) => JSON.parse(line) as { event: string });
    expect(lines.filter((line) => line.event === "chat_turn")).toEqual([answeredTurn]);
    expect(printed.join("\n")).not.toContain("thread-of-one-visitor");
    expect(upstash.requests.map((request) => request.body).join("\n")).not.toContain("thread-of-one-visitor");
  });

  test("record() adds each turn to the day's totals: totals(1) shows the outcome counts, the five token counts and the longest duration", async () => {
    const ops = functionInstance();
    // A shorter turn after a longer one: the longest duration stays the longer one's.
    const notCoveredTurn: ChatTurnEvent = {
      event: "chat_turn",
      outcome: "refusal:not-covered",
      reads: 0,
      citations: 0,
      removed: 1,
      modelCalls: 1,
      inputTokens: 40,
      cachedInputTokens: 9_000,
      cacheWriteTokens: 500,
      cacheWrite1hTokens: 200,
      outputTokens: 120,
      durationMs: 3_100,
      errorCode: null,
    };

    await ops.telemetry.record(answeredTurn, await reserveOn(ops));
    await ops.telemetry.record(notCoveredTurn, await reserveOn(ops));

    expect(await ops.totals(1)).toEqual([
      {
        date: "2026-10-27",
        turns: { answered: 1, "refusal:out-of-scope": 0, "refusal:not-covered": 1, stopped: 0, error: 0, limit: 0 },
        modelCalls: 3,
        reads: 1,
        citations: 1,
        removed: 1,
        inputTokens: 1_240,
        cachedInputTokens: 18_000,
        cacheWriteTokens: 800,
        cacheWrite1hTokens: 200,
        outputTokens: 570,
        errors: {},
        durationMs: 11_500,
        longestDurationMs: 8_400,
      },
    ]);
  });

  test("a turn with known token counts, 1-hour writes among them, settles with the worked example's cost, on its day and in its month", async () => {
    const ops = functionInstance();

    await ops.telemetry.record(workedExampleTurn, await reserveOn(ops));

    // The worked example, counted by hand at the prices per million tokens:
    //   uncached input   3,000 × $2.00 =  6,000    millionths of a dollar
    //   cache reads     40,005 × $0.10 =  4,000.5
    //   5-minute writes 10,000 × $2.50 = 25,000    (12,000 writes, less the 2,000 1-hour ones)
    //   1-hour writes    2,000 × $4.00 =  8,000
    //   output           1,500 × $10   = 15,000
    // The sum, 58,000.5, rounds up to 58,001, so the estimate is never low. The $0.90 reservation
    // (900,000) is replaced with it.
    expect(upstash.get("qcost:2026-10-27")).toBe("58001");
    expect(upstash.get("qcost:2026-10")).toBe("58001");
  });

  test("settling a smaller real cost frees room for another turn", async () => {
    const ops = functionInstance();
    const reservations = [];
    for (let turn = 0; turn < 8; turn++) reservations.push(await reserveOn(ops));

    // 8 × $0.90 = $7.20 reserved. Without the settlement, a ninth reservation would make $8.10 and be refused.
    await ops.telemetry.record(workedExampleTurn, reservations[0]);

    expect(await ops.budget.reserve()).toEqual({ ok: true, reservation: expect.any(String) });
    // $7.20 − $0.90 + $0.058001 + $0.90, in millionths of a dollar.
    expect(upstash.get("qcost:2026-10-27")).toBe("7258001");
  });

  test("a turn with null token counts keeps its whole reservation, and adds no tokens to the totals", async () => {
    const ops = functionInstance();
    const noCallFinished: ChatTurnEvent = {
      ...answeredTurn,
      outcome: "error",
      modelCalls: 1,
      inputTokens: null,
      cachedInputTokens: null,
      cacheWriteTokens: null,
      cacheWrite1hTokens: null,
      outputTokens: null,
      errorCode: "529",
    };

    await ops.telemetry.record(noCallFinished, await reserveOn(ops));

    // $0.90 is 900,000 millionths of a dollar: it stays on the day and is the month's cost of the turn.
    expect(upstash.get("qcost:2026-10-27")).toBe("900000");
    expect(upstash.get("qcost:2026-10")).toBe("900000");
    const [today] = await ops.totals(1);
    expect(today).toMatchObject({ inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, cacheWrite1hTokens: 0, outputTokens: 0 });
    expect(today).toMatchObject({ turns: { error: 1 }, errors: { "529": 1 } });
  });

  test.each([
    ["a stopped turn", { outcome: "stopped", errorCode: null }],
    ["a DEADLINE turn", { outcome: "error", errorCode: "DEADLINE" }],
  ] as const)(
    "%s, whose first model call finished and whose second did not, keeps its whole reservation, and the totals show the first call's tokens only",
    async (_label, ending) => {
      const ops = functionInstance();
      // The usage middleware summed the first call only: the second reported none.
      const firstCallOnly: ChatTurnEvent = {
        ...answeredTurn,
        ...ending,
        modelCalls: 2,
        inputTokens: 1_100,
        cachedInputTokens: 0,
        cacheWriteTokens: 9_200,
        cacheWrite1hTokens: 0,
        outputTokens: 310,
      };

      await ops.telemetry.record(firstCallOnly, await reserveOn(ops));

      expect(upstash.get("qcost:2026-10-27")).toBe("900000");
      expect(upstash.get("qcost:2026-10")).toBe("900000");
      expect((await ops.totals(1))[0]).toMatchObject({
        turns: { [ending.outcome]: 1 },
        errors: ending.errorCode ? { [ending.errorCode]: 1 } : {},
        modelCalls: 2,
        inputTokens: 1_100,
        cachedInputTokens: 0,
        cacheWriteTokens: 9_200,
        cacheWrite1hTokens: 0,
        outputTokens: 310,
      });
    },
  );

  test("a rejected turn and a limit refusal write nothing to the store, and print their chat_turn lines", async () => {
    const ops = functionInstance();
    const noModelCall = { ...answeredTurn, reads: 0, citations: 0, modelCalls: 0, durationMs: 4 };
    const noTokens = { inputTokens: null, cachedInputTokens: null, cacheWriteTokens: null, cacheWrite1hTokens: null, outputTokens: null };
    const rejected: ChatTurnEvent = { ...noModelCall, ...noTokens, outcome: "rejected", errorCode: null };
    const refusedAtTheCap: ChatTurnEvent = { ...noModelCall, ...noTokens, outcome: "limit", errorCode: "DAILY_LIMIT" };

    // Neither holds a reservation: a rejected request never reserves, and a refused one got none.
    await ops.telemetry.record(rejected);
    await ops.telemetry.record(refusedAtTheCap, undefined);

    expect(upstash.requests).toEqual([]);
    expect(printed.map((line) => JSON.parse(line) as unknown)).toEqual([rejected, refusedAtTheCap]);
  });

  test("each record() is one /multi-exec transaction that gives every key it writes its expiry", async () => {
    const ops = functionInstance();
    const reservation = await reserveOn(ops);
    const reserveRequests = upstash.requests.length;

    await ops.telemetry.record(workedExampleTurn, reservation);

    const records = upstash.requests.slice(reserveRequests);
    expect(records.map((request) => request.path)).toEqual(["/multi-exec"]);
    const commands = JSON.parse(records[0]!.body) as string[][];
    const written = new Set(commands.filter(([name]) => name !== "EXPIREAT").map(([, key]) => key));
    const expiring = new Set(commands.filter(([name]) => name === "EXPIREAT").map(([, key]) => key));
    expect(written).toEqual(new Set(["qstats:2026-10-27", "qslow:2026-10-27", "qcost:2026-10-27", "qcost:2026-10"]));
    expect(expiring).toEqual(written);
  });

  // Each expiry is counted by hand. A day's keys: 00:00 UTC on the 90th day after the day. The month's:
  // 90 days after the month ends, at 00:00 UTC on the next month's first day.
  test.each([
    ["2026-10-27", "2027-01-25T00:00:00.000Z", "2026-10", "2027-01-30T00:00:00.000Z"],
    ["2026-12-31", "2027-03-31T00:00:00.000Z", "2026-12", "2027-04-01T00:00:00.000Z"],
  ])("a turn on %s: its day's totals expire at %s, and qcost:%s at %s", async (day, dayExpiry, month, monthExpiry) => {
    clock = new Date(`${day}T12:00:00.000Z`);
    const ops = functionInstance();

    await ops.telemetry.record(workedExampleTurn, await reserveOn(ops));

    for (const key of [`qstats:${day}`, `qslow:${day}`, `qcost:${day}`]) expect(upstash.expiresAt(key)).toEqual(new Date(dayExpiry));
    expect(upstash.expiresAt(`qcost:${month}`)).toEqual(new Date(monthExpiry));
  });

  test("a turn that ends after 00:00 UTC counts on the day it reserved, and totals(2) gives today first, a day with no turn in zeros", async () => {
    clock = new Date("2026-10-27T23:59:50.000Z");
    const ops = functionInstance();
    const reservation = await reserveOn(ops);

    clock = new Date("2026-10-28T00:00:20.000Z");
    await ops.telemetry.record({ ...answeredTurn, durationMs: 30_000 }, reservation);

    const [today, yesterday] = await ops.totals(2);
    expect(today).toEqual({
      date: "2026-10-28",
      turns: { answered: 0, "refusal:out-of-scope": 0, "refusal:not-covered": 0, stopped: 0, error: 0, limit: 0 },
      modelCalls: 0,
      reads: 0,
      citations: 0,
      removed: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      cacheWrite1hTokens: 0,
      outputTokens: 0,
      errors: {},
      durationMs: 0,
      longestDurationMs: 0,
    });
    expect(yesterday).toMatchObject({ date: "2026-10-27", turns: { answered: 1 }, longestDurationMs: 30_000 });
    expect(upstash.get("qcost:2026-10-28")).toBeNull();
  });
});

describe("the limit alerts, in production on the in-test Upstash and ntfy servers", () => {
  // The function instances and the store share one clock, which a test can move on.
  let clock: Date;
  let upstash: FakeUpstash;
  let ntfy: FakeNtfy;
  let printed: string[];
  beforeEach(() => {
    clock = new Date("2026-10-27T12:00:00.000Z");
    upstash = startFakeUpstash({ now: () => clock });
    ntfy = startFakeNtfy();
    printed = [];
  });
  afterEach(async () => {
    await upstash.stop();
    await ntfy.stop();
  });

  /** The secret topic on the in-test ntfy server. No test name holds it, as no log line may. */
  const topic = "resume-alerts-in-test";

  /** A new production function instance with the store and the alerts set, whose function log is `printed`. */
  const functionInstance = () =>
    createOps(
      {
        VERCEL_ENV: "production",
        KV_REST_API_URL: upstash.url,
        KV_REST_API_TOKEN: upstash.token,
        NTFY_TOPIC_URL: `${ntfy.url}/${topic}`,
      },
      { now: () => clock, print: (line) => printed.push(line) },
    );

  /** Reserves a turn on the instance, as the handler does before its first model call. */
  const reserveOn = async (ops: ReturnType<typeof createOps>) => {
    const ticket = await ops.budget.reserve();
    if (!ticket.ok) throw new Error(`the budget refused the turn with ${ticket.errorCode}`);
    return ticket.reservation;
  };

  /** A turn cut off by the deadline: its last model call did not finish, so it keeps its whole $0.90 reservation. */
  const deadlineTurn: ChatTurnEvent = { ...answeredTurn, outcome: "error", errorCode: "DEADLINE" };

  test("the month's estimate passing 75% of the $20 limit pushes one urgent spend75 with the spec's text; at exactly 75% it pushes none", async () => {
    // $14.10 of October is settled already, in millionths of a dollar.
    upstash.set("qcost:2026-10", "14100000");
    const ops = functionInstance();

    // The kept $0.90 makes $15.00: at 75% of $20, not past it.
    await ops.telemetry.record(deadlineTurn, await reserveOn(ops));
    expect(ntfy.pushes).toEqual([]);

    // The worked example's $0.058001 makes $15.058001: past 75%.
    await ops.telemetry.record(workedExampleTurn, await reserveOn(ops));
    expect(ntfy.pushes).toEqual([
      {
        topic,
        priority: 5,
        title: "Chat at 75% of its $20 limit for October",
        message: "Raise it in the Anthropic Console, then in src/ops/limits.ts.",
        headers: expect.any(Object),
      },
    ]);
  });

  test("spend75 goes out once a month: no later turn that month pushes again, on any function instance, and its marker lasts until 00:00 UTC on the next month's first day", async () => {
    upstash.set("qcost:2026-10", "15000000");
    const first = functionInstance();
    await first.telemetry.record(deadlineTurn, await reserveOn(first));
    expect(ntfy.pushes).toHaveLength(1);

    clock = new Date("2026-10-31T23:59:00.000Z");
    for (const ops of [first, functionInstance(), functionInstance()]) await ops.telemetry.record(deadlineTurn, await reserveOn(ops));

    expect(ntfy.pushes).toHaveLength(1);
    expect(upstash.expiresAt("alert:spend75:2026-10")).toEqual(new Date("2026-11-01T00:00:00.000Z"));
  });

  test("the next month's estimate passing 75% pushes spend75 again, for that month", async () => {
    upstash.set("qcost:2026-10", "15000000");
    const ops = functionInstance();
    await ops.telemetry.record(deadlineTurn, await reserveOn(ops));

    clock = new Date("2026-11-20T09:00:00.000Z");
    upstash.set("qcost:2026-11", "15000000");
    await ops.telemetry.record(deadlineTurn, await reserveOn(ops));

    expect(ntfy.pushes.map((push) => push.title)).toEqual([
      "Chat at 75% of its $20 limit for October",
      "Chat at 75% of its $20 limit for November",
    ]);
  });

  test("17 DAILY_LIMIT refusals at once on 25 function instances push one urgent daycap, with the wording draft's text, and its marker lasts until 00:00 UTC", async () => {
    const budgets = Array.from({ length: 25 }, () => functionInstance().budget);

    const tickets = await Promise.all(budgets.map((budget) => budget.reserve()));

    expect(tickets.filter((ticket) => !ticket.ok)).toHaveLength(17);
    expect(ntfy.pushes).toEqual([
      {
        topic,
        priority: 5,
        title: "Chat paused at its $8 daily cap until 00:00 UTC",
        message: "If bun run questions shows real spend, raise the cap in src/ops/limits.ts.",
        headers: expect.any(Object),
      },
    ]);
    expect(upstash.expiresAt("alert:daycap:2026-10-27")).toEqual(new Date("2026-10-28T00:00:00.000Z"));
  });

  test("after the daycap push, the instance that pushed and an instance that found the marker refuse later turns that day with no store call", async () => {
    const pushed = functionInstance().budget;
    for (let turn = 0; turn < 8; turn++) await pushed.reserve();
    expect(await pushed.reserve()).toEqual({ ok: false, errorCode: "DAILY_LIMIT" });
    // A second instance's first refusal: its reservation, the take-back and a claim that finds the marker.
    const found = functionInstance().budget;
    expect(await found.reserve()).toEqual({ ok: false, errorCode: "DAILY_LIMIT" });
    const storeCalls = upstash.requests.length;

    clock = new Date("2026-10-27T23:59:59.999Z");
    for (const budget of [pushed, found, pushed, found]) expect(await budget.reserve()).toEqual({ ok: false, errorCode: "DAILY_LIMIT" });

    expect(upstash.requests).toHaveLength(storeCalls);
    expect(ntfy.pushes).toHaveLength(1);
  });

  test("the next UTC day's first DAILY_LIMIT refusal pushes daycap again", async () => {
    const budget = functionInstance().budget;
    for (let turn = 0; turn < 9; turn++) await budget.reserve();

    clock = new Date("2026-10-28T00:00:00.000Z");
    for (let turn = 0; turn < 9; turn++) await budget.reserve();

    expect(ntfy.pushes).toHaveLength(2);
    expect(upstash.expiresAt("alert:daycap:2026-10-28")).toEqual(new Date("2026-10-29T00:00:00.000Z"));
  });

  type Instance = ReturnType<typeof createOps>;
  /** Each kind: its marker's period at noon on 2026-10-27, the setup that brings it to its limit, and the event that raises it. */
  const alertKinds: [kind: string, period: string, atTheLimit: (ops: Instance) => Promise<void>, event: (ops: Instance) => Promise<void>][] = [
    [
      "daycap",
      "2026-10-27",
      async (ops) => {
        for (let turn = 0; turn < 8; turn++) await reserveOn(ops);
      },
      async (ops) => {
        await ops.budget.reserve();
      },
    ],
    [
      "spend75",
      "2026-10",
      async () => upstash.set("qcost:2026-10", "15000000"),
      async (ops) => ops.telemetry.record(deadlineTurn, await reserveOn(ops)),
    ],
  ];

  test.each(alertKinds)(
    "a %s push first claims its marker with SET NX and a 10-minute expiry, in one /multi-exec transaction",
    async (kind, period, atTheLimit, event) => {
      const ops = functionInstance();
      await atTheLimit(ops);
      const before = upstash.requests.length;

      await event(ops);

      const claims = upstash.requests.slice(before).filter((request) => request.body.includes('"SET"'));
      expect(claims.map((request) => [request.path, JSON.parse(request.body)])).toEqual([
        [
          "/multi-exec",
          [
            ["SET", `alert:${kind}:${period}`, "2026-10-27T12:00:00.000Z", "NX", "EX", "600"],
            ["PTTL", `alert:${kind}:${period}`],
          ],
        ],
      ]);
      expect(ntfy.pushes).toHaveLength(1);
    },
  );

  test.each(alertKinds)(
    "a %s push that ntfy refuses leaves its marker for 10 minutes and prints an ops_error line; the first event after them pushes again",
    async (kind, period, atTheLimit, event) => {
      const ops = functionInstance();
      await atTheLimit(ops);
      ntfy.refuseNext(1);

      await event(ops);

      expect(ntfy.refused()).toBe(1);
      expect(ntfy.pushes).toEqual([]);
      expect(upstash.expiresAt(`alert:${kind}:${period}`)).toEqual(new Date("2026-10-27T12:10:00.000Z"));
      expect(printed.map((line) => JSON.parse(line) as unknown)).toContainEqual({ event: "ops_error", step: "alert_push", alert: kind, code: "HTTP_429" });

      // While the marker lives, neither this instance nor another one pushes.
      clock = new Date("2026-10-27T12:09:59.999Z");
      await event(ops);
      await event(functionInstance());
      expect(ntfy.refused() + ntfy.pushes.length).toBe(1);

      clock = new Date("2026-10-27T12:10:00.001Z");
      await event(ops);
      expect(ntfy.pushes).toHaveLength(1);
      expect(upstash.expiresAt(`alert:${kind}:${period}`)).toEqual(new Date(kind === "daycap" ? "2026-10-28T00:00:00.000Z" : "2026-11-01T00:00:00.000Z"));
    },
  );

  test(
    "with the ntfy server holding its answers, reserve() at the daily cap and record() past 75% each return within about 3 s; each push counts as failed, and a later event pushes again",
    async () => {
      // October at exactly 75% of its limit, and the day 8 reservations in: one more $0.90 takes each past its limit.
      upstash.set("qcost:2026-10", "15000000");
      const ops = functionInstance();
      const reservations: string[] = [];
      for (let turn = 0; turn < 8; turn++) reservations.push(await reserveOn(ops));
      ntfy.holdNext(2);
      const timed = async (event: () => Promise<unknown>) => {
        const started = performance.now();
        await event();
        return performance.now() - started;
      };

      // Both events run at once, so the test waits out one time limit, not two.
      const durations = await Promise.all([
        timed(async () => expect(await ops.budget.reserve()).toEqual({ ok: false, errorCode: "DAILY_LIMIT" })),
        timed(() => ops.telemetry.record(deadlineTurn, reservations[0])),
      ]);

      // SPEC-deploy, "Store calls": each push, 3 s. Without the limit neither event returns, and the test times out.
      expect(ntfy.held()).toBe(2);
      for (const duration of durations) expect(duration).toBeLessThan(4_000);
      // A push that timed out is a failed push: its marker expires in 10 minutes, and its line holds one word.
      expect(upstash.expiresAt("alert:daycap:2026-10-27")).toEqual(new Date("2026-10-27T12:10:00.000Z"));
      expect(upstash.expiresAt("alert:spend75:2026-10")).toEqual(new Date("2026-10-27T12:10:00.000Z"));
      const opsErrors = printed.map((line) => JSON.parse(line) as Record<string, unknown>).filter((line) => line.event === "ops_error");
      expect(opsErrors).toHaveLength(2);
      expect(opsErrors).toContainEqual({ event: "ops_error", step: "alert_push", alert: "daycap", code: "TimeoutError" });
      expect(opsErrors).toContainEqual({ event: "ops_error", step: "alert_push", alert: "spend75", code: "TimeoutError" });
      expect(printed.join("\n")).not.toContain(topic);

      clock = new Date("2026-10-27T12:10:00.001Z");
      expect(await ops.budget.reserve()).toEqual({ ok: false, errorCode: "DAILY_LIMIT" });
      await ops.telemetry.record(deadlineTurn, reservations[1]);
      expect(ntfy.pushes.map((push) => push.title)).toEqual([
        "Chat paused at its $8 daily cap until 00:00 UTC",
        "Chat at 75% of its $20 limit for October",
      ]);
    },
    15_000,
  );

  test("no push holds question text: not its title, its line or any header", async () => {
    const question = "Our confidential Example Corp posting pays $250k; does Peter fit it?";
    upstash.set("qcost:2026-10", "15000000");
    const ops = functionInstance();

    await ops.log.append({ ...answeredEntry, question });
    for (let turn = 0; turn < 8; turn++) await ops.telemetry.record(deadlineTurn, await reserveOn(ops));
    expect(await ops.budget.reserve()).toEqual({ ok: false, errorCode: "DAILY_LIMIT" });

    // Both kinds went out, so the check below reads real pushes.
    expect(ntfy.pushes.map((push) => push.title)).toEqual([
      "Chat at 75% of its $20 limit for October",
      "Chat paused at its $8 daily cap until 00:00 UTC",
    ]);
    for (const push of ntfy.pushes) {
      expect(JSON.stringify(push)).not.toContain("Example Corp");
      expect(JSON.stringify(push)).not.toContain("$250k");
    }
  });

  test("in production with no NTFY_TOPIC_URL, the daily cap and the 75% mark push nothing, throw nothing and claim no marker", async () => {
    upstash.set("qcost:2026-10", "15000000");
    const ops = createOps(
      { VERCEL_ENV: "production", KV_REST_API_URL: upstash.url, KV_REST_API_TOKEN: upstash.token },
      { now: () => clock, print: (line) => printed.push(line) },
    );

    for (let turn = 0; turn < 8; turn++) await ops.telemetry.record(deadlineTurn, await reserveOn(ops));
    expect(await ops.budget.reserve()).toEqual({ ok: false, errorCode: "DAILY_LIMIT" });

    expect(ntfy.pushes).toEqual([]);
    expect(upstash.requests.filter((request) => request.body.includes('"SET"'))).toEqual([]);
  });

  test("a topic address that is not https gets no request, so the topic never goes in clear text, and the ops_error line says NOT_HTTPS", async () => {
    const reached: string[] = [];
    // The store's calls go through; any other request is recorded and fails.
    const storeOnlyFetch = ((input: string | URL | Request, init?: RequestInit) => {
      if (String(input).startsWith(upstash.url)) return fetch(input, init);
      reached.push(String(input));
      return Promise.reject(new TypeError("no request may leave the test"));
    }) as typeof fetch;
    const ops = createOps(
      {
        VERCEL_ENV: "production",
        KV_REST_API_URL: upstash.url,
        KV_REST_API_TOKEN: upstash.token,
        NTFY_TOPIC_URL: `http://ntfy.example/${topic}`,
      },
      { now: () => clock, print: (line) => printed.push(line), fetch: storeOnlyFetch },
    );

    for (let turn = 0; turn < 9; turn++) await ops.budget.reserve();

    expect(reached).toEqual([]);
    expect(upstash.requests.filter((request) => request.body.includes('"SET"'))).toEqual([]);
    expect(printed.map((line) => JSON.parse(line) as unknown)).toEqual([
      { event: "ops_error", step: "alert_push", alert: "daycap", code: "NOT_HTTPS" },
    ]);
  });

  test("a push whose request throws prints an ops_error line with one word for the error, and never the topic or its address", async () => {
    const ops = functionInstance();
    for (let turn = 0; turn < 8; turn++) await reserveOn(ops);
    // Nothing answers at the topic's address any more, so the real fetch throws.
    await ntfy.stop();

    expect(await ops.budget.reserve()).toEqual({ ok: false, errorCode: "DAILY_LIMIT" });

    expect(printed).toHaveLength(1);
    expect(JSON.parse(printed[0]!)).toEqual({ event: "ops_error", step: "alert_push", alert: "daycap", code: expect.stringMatching(/^[A-Za-z0-9_]{1,32}$/) });
    expect(printed[0]).not.toContain(topic);
    expect(printed[0]).not.toContain(new URL(ntfy.url).port);
  });
});

describe("store failures, in production on the in-test Upstash and ntfy servers", () => {
  // The function instances and the store share one clock, which a test can move on.
  let clock: Date;
  let upstash: FakeUpstash;
  let ntfy: FakeNtfy;
  let printed: string[];
  beforeEach(() => {
    clock = new Date("2026-10-27T12:00:00.000Z");
    upstash = startFakeUpstash({ now: () => clock });
    ntfy = startFakeNtfy();
    printed = [];
  });
  afterEach(async () => {
    await upstash.stop();
    await ntfy.stop();
  });

  /** The secret topic on the in-test ntfy server. No test name holds it, as no log line may. */
  const topic = "resume-alerts-in-test";

  /** A new production function instance with the store and the alerts set, whose function log is `printed`. */
  const functionInstance = () =>
    createOps(
      {
        VERCEL_ENV: "production",
        KV_REST_API_URL: upstash.url,
        KV_REST_API_TOKEN: upstash.token,
        NTFY_TOPIC_URL: `${ntfy.url}/${topic}`,
      },
      { now: () => clock, print: (line) => printed.push(line) },
    );

  /** The ops_error lines in the function log, in the order printed. */
  const opsErrors = () => printed.map((line) => JSON.parse(line) as Record<string, unknown>).filter((line) => line.event === "ops_error");

  test("with the Upstash server returning 500, reserve() allows the turn, record() and append() resolve, and each prints an ops_error line with the store's 500", async () => {
    upstash.failEvery(500);
    const ops = functionInstance();

    const ticket = await ops.budget.reserve();
    if (!ticket.ok) throw new Error(`the budget refused the turn with ${ticket.errorCode}`);
    await expect(ops.telemetry.record(answeredTurn, ticket.reservation)).resolves.toBeUndefined();
    await expect(ops.log.append(answeredEntry)).resolves.toBeUndefined();

    expect(opsErrors()).toEqual([
      { event: "ops_error", step: "reserve", code: "HTTP_500" },
      { event: "ops_error", step: "record", code: "HTTP_500" },
      { event: "ops_error", step: "append", code: "HTTP_500" },
    ]);
  });

  test("with the Upstash server returning 500, the instance pushes one urgent storefail that day, with the wording draft's text, however many of its store calls fail", async () => {
    upstash.failEvery(500);
    const ops = functionInstance();

    for (let turn = 0; turn < 3; turn++) {
      const ticket = await ops.budget.reserve();
      if (!ticket.ok) throw new Error(`the budget refused the turn with ${ticket.errorCode}`);
      await ops.telemetry.record(answeredTurn, ticket.reservation);
      await ops.log.append(answeredEntry);
    }
    clock = new Date("2026-10-27T23:59:59.999Z");
    await ops.budget.reserve();

    expect(ntfy.pushes).toEqual([
      {
        topic,
        priority: 5,
        title: "Chat store failed: answers go on without the $8 daily cap",
        message: "Check the Upstash console for an outage or a spent budget.",
        headers: expect.any(Object),
      },
    ]);
  });

  test("a storefail marker lives only on its function instance, never in the failing store: another instance pushes its own, and the next UTC day pushes again", async () => {
    upstash.failEvery(500);
    const first = functionInstance();
    const second = functionInstance();

    await first.budget.reserve();
    await second.budget.reserve();
    expect(ntfy.pushes).toHaveLength(2);

    clock = new Date("2026-10-28T00:00:00.000Z");
    await first.budget.reserve();

    expect(ntfy.pushes).toHaveLength(3);
    expect(upstash.requests.filter((request) => request.body.includes('"SET"'))).toEqual([]);
  });

  test("a storefail push that ntfy refuses prints an ops_error line, and the first store failure 10 minutes later pushes again", async () => {
    upstash.failEvery(500);
    ntfy.refuseNext(1);
    const ops = functionInstance();

    await ops.budget.reserve();
    expect(ntfy.refused()).toBe(1);
    expect(opsErrors()).toContainEqual({ event: "ops_error", step: "alert_push", alert: "storefail", code: "HTTP_429" });

    clock = new Date("2026-10-27T12:09:59.999Z");
    await ops.budget.reserve();
    expect(ntfy.refused() + ntfy.pushes.length).toBe(1);

    clock = new Date("2026-10-27T12:10:00.001Z");
    await ops.budget.reserve();
    expect(ntfy.pushes).toHaveLength(1);
  });

  // Counted by hand: the worked example's cost is 58,001 millionths of a dollar (see the telemetry's
  // tests), and a turn cut off by the deadline keeps its whole $0.90, 900,000.
  test.each([
    ["a turn whose model calls all finished", workedExampleTurn, "58001"],
    ["a DEADLINE turn", { ...answeredTurn, outcome: "error", errorCode: "DEADLINE" } satisfies ChatTurnEvent, "900000"],
  ] as const)(
    "%s that reserve() allowed while the store failed adds its whole cost to its day and its month once the store answers again",
    async (_label, turn, cost) => {
      upstash.failEvery(500);
      const ops = functionInstance();
      const ticket = await ops.budget.reserve();
      if (!ticket.ok) throw new Error(`the budget refused the turn with ${ticket.errorCode}`);

      upstash.recover();
      await ops.telemetry.record(turn, ticket.reservation);

      // The $0.90 never reached the day's cost, so record() takes none of it back: the day gets the
      // whole cost, never the cost less $0.90.
      expect(upstash.get("qcost:2026-10-27")).toBe(cost);
      expect(upstash.get("qcost:2026-10")).toBe(cost);
    },
  );

  /** How long an event takes, in milliseconds. */
  const timed = async (event: () => Promise<unknown>) => {
    const started = performance.now();
    await event();
    return performance.now() - started;
  };

  test(
    "with the Upstash server holding every response, reserve() allows the turn within about 1 s, and record() and append() resolve within about 2 s",
    async () => {
      upstash.holdEvery();
      const ops = functionInstance();

      let reservation = "";
      const reserving = await timed(async () => {
        const ticket = await ops.budget.reserve();
        if (!ticket.ok) throw new Error(`the budget refused the turn with ${ticket.errorCode}`);
        reservation = ticket.reservation;
      });
      // Both run at once, as the handler runs them after the last chunk, so the test waits out one limit, not two.
      const [recording, appending] = await Promise.all([
        timed(() => ops.telemetry.record(answeredTurn, reservation)),
        timed(() => ops.log.append(answeredEntry)),
      ]);

      // SPEC-deploy, "Store calls": reserve() 1 s, each other store call 2 s. Without the limits nothing returns, and the test times out.
      expect(upstash.held()).toBe(3);
      expect(reserving).toBeLessThan(1_500);
      expect(recording).toBeLessThan(2_500);
      expect(appending).toBeLessThan(2_500);
      // record() and append() time out together, so their lines can come in either order.
      expect(opsErrors()).toHaveLength(3);
      for (const step of ["reserve", "record", "append"]) expect(opsErrors()).toContainEqual({ event: "ops_error", step, code: "TIMEOUT" });
      expect(ntfy.pushes.map((push) => push.title)).toEqual(["Chat store failed: answers go on without the $8 daily cap"]);
    },
    10_000,
  );

  test(
    "with the Upstash server returning 500 and the ntfy server holding its answers, reserve() still allows the turn within about 3 s: the storefail push stops after 3 s and counts as failed",
    async () => {
      upstash.failEvery(500);
      ntfy.holdNext(1);
      const ops = functionInstance();

      const reserving = await timed(async () => expect(await ops.budget.reserve()).toEqual({ ok: true, reservation: expect.any(String) }));

      // SPEC-deploy, "Store calls": each push, 3 s.
      expect(ntfy.held()).toBe(1);
      expect(reserving).toBeLessThan(4_000);
      expect(opsErrors()).toEqual([
        { event: "ops_error", step: "reserve", code: "HTTP_500" },
        { event: "ops_error", step: "alert_push", alert: "storefail", code: "TimeoutError" },
      ]);
      expect(printed.join("\n")).not.toContain(topic);
    },
    10_000,
  );

  test("with no store at the store's address, reserve() allows the turn, and its ops_error line says NETWORK and holds neither the address nor the token", async () => {
    // A server that has stopped: nothing answers at its address, so the request itself fails.
    const gone = startFakeUpstash();
    const address = gone.url;
    await gone.stop();
    const ops = createOps(
      { VERCEL_ENV: "production", KV_REST_API_URL: address, KV_REST_API_TOKEN: "token-in-test", NTFY_TOPIC_URL: `${ntfy.url}/${topic}` },
      { now: () => clock, print: (line) => printed.push(line) },
    );

    expect(await ops.budget.reserve()).toEqual({ ok: true, reservation: expect.any(String) });

    expect(opsErrors()).toEqual([{ event: "ops_error", step: "reserve", code: "NETWORK" }]);
    expect(printed.join("\n")).not.toContain(new URL(address).port);
    expect(printed.join("\n")).not.toContain("token-in-test");
    expect(ntfy.pushes).toHaveLength(1);
  });

  test(
    "a daycap claim that the store holds stops after 2 s: reserve() at the daily cap still refuses within about 2 s, prints the claim's ops_error line and pushes storefail",
    async () => {
      const ops = functionInstance();
      for (let turn = 0; turn < 8; turn++) await ops.budget.reserve();
      // The ninth reservation and its take-back go through; the claim of the daycap marker gets no answer.
      upstash.holdEvery((body) => body.includes('"SET"'));

      const refusing = await timed(async () => expect(await ops.budget.reserve()).toEqual({ ok: false, errorCode: "DAILY_LIMIT" }));

      expect(upstash.held()).toBe(1);
      expect(refusing).toBeLessThan(2_500);
      expect(opsErrors()).toEqual([{ event: "ops_error", step: "alert_claim", alert: "daycap", code: "TIMEOUT" }]);
      expect(ntfy.pushes.map((push) => push.title)).toEqual(["Chat store failed: answers go on without the $8 daily cap"]);
    },
    10_000,
  );
});

describe("the monthly limit, in production on the in-test Upstash and ntfy servers", () => {
  // The function instances and the store share one clock, which a test moves on.
  let clock: Date;
  let upstash: FakeUpstash;
  let ntfy: FakeNtfy;
  beforeEach(() => {
    clock = new Date("2026-10-27T12:00:00.000Z");
    upstash = startFakeUpstash({ now: () => clock });
    ntfy = startFakeNtfy();
  });
  afterEach(async () => {
    await upstash.stop();
    await ntfy.stop();
  });

  /** A new production function instance with the store and the alerts set. */
  const functionInstance = () =>
    createOps(
      { VERCEL_ENV: "production", KV_REST_API_URL: upstash.url, KV_REST_API_TOKEN: upstash.token, NTFY_TOPIC_URL: `${ntfy.url}/resume-alerts-in-test` },
      { now: () => clock, print: () => {} },
    );

  /** Reserves a turn on the instance, as the handler does before its first model call. */
  const reserveOn = async (ops: ReturnType<typeof createOps>) => {
    const ticket = await ops.budget.reserve();
    if (!ticket.ok) throw new Error(`the budget refused the turn with ${ticket.errorCode}`);
    return ticket.reservation;
  };

  /** The chat_turn event of a turn whose first model call met Anthropic's monthly limit: the handler ends it with SPEND_LIMIT. */
  const spendLimitTurn: ChatTurnEvent = {
    event: "chat_turn",
    outcome: "limit",
    reads: 0,
    citations: 0,
    removed: 0,
    modelCalls: 1,
    inputTokens: null,
    cachedInputTokens: null,
    cacheWriteTokens: null,
    cacheWrite1hTokens: null,
    outputTokens: null,
    durationMs: 600,
    errorCode: "SPEND_LIMIT",
  };

  test("after a turn meets Anthropic's limit, reserve() refuses with SPEND_LIMIT for an hour on every function instance, then lets exactly one probe through", async () => {
    const first = functionInstance();
    await first.telemetry.record(spendLimitTurn, await reserveOn(first));

    for (const at of ["2026-10-27T12:00:01.000Z", "2026-10-27T12:59:59.999Z"]) {
      clock = new Date(at);
      for (const ops of [first, functionInstance()]) expect(await ops.budget.reserve()).toEqual({ ok: false, errorCode: "SPEND_LIMIT" });
    }

    // An hour after the turn met the limit, 25 turns arrive at once on 25 function instances.
    clock = new Date("2026-10-27T13:00:00.000Z");
    const budgets = Array.from({ length: 25 }, () => functionInstance().budget);
    const tickets = await Promise.all(budgets.map((budget) => budget.reserve()));

    expect(tickets.filter((ticket) => ticket.ok)).toEqual([{ ok: true, reservation: expect.any(String) }]);
    expect(tickets.filter((ticket) => !ticket.ok)).toEqual(Array.from({ length: 24 }, () => ({ ok: false, errorCode: "SPEND_LIMIT" })));
    // The hour's probe claim lives 2 hours.
    expect(upstash.expiresAt("limit:probe:2026-10-27T13")).toEqual(new Date("2026-10-27T15:00:00.000Z"));
    // The first turn settled at $0, because none of its model calls finished (row 184), and every refusal took its
    // $0.90 back: the day holds the probe's open $0.90 only, in millionths of a dollar.
    expect(upstash.get("qcost:2026-10-27")).toBe("900000");
  });

  test("a SPEND_LIMIT turn with no finished model call gives its whole $0.90 back to the day and adds $0 to the month", async () => {
    const ops = functionInstance();

    await ops.telemetry.record(spendLimitTurn, await reserveOn(ops));

    // Anthropic refused the call at its limit, so the call ran no tokens and cost nothing (row 184).
    expect(upstash.get("qcost:2026-10-27")).toBe("0");
    expect(upstash.get("qcost:2026-10")).toBe("0");
  });

  test("a SPEND_LIMIT turn whose first model call finished settles at that call's cost, on its day and in its month", async () => {
    const ops = functionInstance();
    // The first call finished with the worked example's usage; Anthropic refused the second at its limit.
    const firstCallFinished: ChatTurnEvent = { ...workedExampleTurn, outcome: "limit", modelCalls: 2, errorCode: "SPEND_LIMIT" };

    await ops.telemetry.record(firstCallFinished, await reserveOn(ops));

    // The worked example's cost, counted by hand in the telemetry tests above: 58,001 millionths of a dollar.
    expect(upstash.get("qcost:2026-10-27")).toBe("58001");
    expect(upstash.get("qcost:2026-10")).toBe("58001");
  });

  test("a SPEND_LIMIT turn whose token counts cannot be true keeps its whole $0.90, because its usage is not known", async () => {
    const ops = functionInstance();
    // More 1-hour cache writes than cache writes: no finished call reports that.
    const countsNotTrue: ChatTurnEvent = { ...workedExampleTurn, outcome: "limit", modelCalls: 2, cacheWrite1hTokens: 20_000, errorCode: "SPEND_LIMIT" };

    await ops.telemetry.record(countsNotTrue, await reserveOn(ops));

    expect(upstash.get("qcost:2026-10-27")).toBe("900000");
    expect(upstash.get("qcost:2026-10")).toBe("900000");
  });

  test("nine failed probes in one UTC day leave the day under the $8 cap, and the next hour's probe still runs", async () => {
    clock = new Date("2026-10-27T00:00:00.000Z");
    const first = functionInstance();
    await first.telemetry.record(spendLimitTurn, await reserveOn(first));

    // While the limit holds, the probe of each hour from 01:00 to 09:00 meets it again.
    for (let hour = 1; hour <= 9; hour++) {
      clock = new Date(`2026-10-27T0${hour}:00:00.000Z`);
      const prober = functionInstance();
      await prober.telemetry.record(spendLimitTurn, await reserveOn(prober));
    }

    // Ten turns met the limit, and each settled at $0. With $0.90 kept for each, the eighth probe's reservation would pass the cap.
    expect(upstash.get("qcost:2026-10-27")).toBe("0");
    clock = new Date("2026-10-27T10:00:00.000Z");
    expect(await functionInstance().budget.reserve()).toEqual({ ok: true, reservation: expect.any(String) });
  });

  test("a turn that meets the limit sets limit:spend to its time in record()'s one transaction, until 00:00 UTC on the next month's first day", async () => {
    const ops = functionInstance();
    const reservation = await reserveOn(ops);
    clock = new Date("2026-10-27T12:00:05.000Z");
    const before = upstash.requests.length;

    await ops.telemetry.record(spendLimitTurn, reservation);

    const records = upstash.requests.slice(before).filter((request) => request.body.includes("qstats:"));
    expect(records.map((request) => request.path)).toEqual(["/multi-exec"]);
    expect(JSON.parse(records[0]!.body)).toEqual(
      expect.arrayContaining([
        ["SET", "limit:spend", "2026-10-27T12:00:05.000Z"],
        ["EXPIREAT", "limit:spend", String(Date.parse("2026-11-01T00:00:00.000Z") / 1000)],
      ]),
    );
    expect(upstash.get("limit:spend")).toBe("2026-10-27T12:00:05.000Z");
    expect(upstash.expiresAt("limit:spend")).toEqual(new Date("2026-11-01T00:00:00.000Z"));
  });

  test("while the marker is less than an hour old, a function instance that has read it refuses with no store call", async () => {
    const ops = functionInstance();
    await ops.telemetry.record(spendLimitTurn, await reserveOn(ops));
    clock = new Date("2026-10-27T12:10:00.000Z");
    // The first refusal reads the marker: the reservation's transaction and its take-back.
    expect(await ops.budget.reserve()).toEqual({ ok: false, errorCode: "SPEND_LIMIT" });
    const storeCalls = upstash.requests.length;

    for (const at of ["2026-10-27T12:30:00.000Z", "2026-10-27T12:59:59.999Z"]) {
      clock = new Date(at);
      expect(await ops.budget.reserve()).toEqual({ ok: false, errorCode: "SPEND_LIMIT" });
    }

    expect(upstash.requests).toHaveLength(storeCalls);
  });

  test("a refusal before the model call writes nothing in record(), so the marker keeps its time and the hour ends when it should", async () => {
    const ops = functionInstance();
    await ops.telemetry.record(spendLimitTurn, await reserveOn(ops));
    // The handler records a SPEND_LIMIT refusal with no reservation and no model call.
    const refused: ChatTurnEvent = { ...spendLimitTurn, modelCalls: 0, durationMs: 3 };
    clock = new Date("2026-10-27T12:40:00.000Z");
    expect(await ops.budget.reserve()).toEqual({ ok: false, errorCode: "SPEND_LIMIT" });
    const storeCalls = upstash.requests.length;

    await ops.telemetry.record(refused, undefined);

    expect(upstash.requests).toHaveLength(storeCalls);
    expect(upstash.get("limit:spend")).toBe("2026-10-27T12:00:00.000Z");
    clock = new Date("2026-10-27T13:00:00.000Z");
    expect(await ops.budget.reserve()).toEqual({ ok: true, reservation: expect.any(String) });
  });

  test("a probe whose model call finished deletes limit:spend, and every function instance allows turns again", async () => {
    const first = functionInstance();
    await first.telemetry.record(spendLimitTurn, await reserveOn(first));
    // Another instance reads the marker at 12:30, so it remembers the hour that ends at 13:00.
    clock = new Date("2026-10-27T12:30:00.000Z");
    const other = functionInstance();
    expect(await other.budget.reserve()).toEqual({ ok: false, errorCode: "SPEND_LIMIT" });

    // Peter has raised the limit in the Console: the probe at 13:05 gets its answer.
    clock = new Date("2026-10-27T13:05:00.000Z");
    const prober = functionInstance();
    const probe = await reserveOn(prober);
    clock = new Date("2026-10-27T13:05:08.000Z");
    await prober.telemetry.record(answeredTurn, probe);

    expect(upstash.get("limit:spend")).toBeNull();
    for (const ops of [first, other, prober, functionInstance()]) {
      expect(await ops.budget.reserve()).toEqual({ ok: true, reservation: expect.any(String) });
    }
  });

  test("a probe that meets the limit again resets the marker's time: the next probe goes through an hour after it", async () => {
    const first = functionInstance();
    await first.telemetry.record(spendLimitTurn, await reserveOn(first));
    clock = new Date("2026-10-27T13:05:00.000Z");
    const prober = functionInstance();
    const probe = await reserveOn(prober);

    clock = new Date("2026-10-27T13:05:01.000Z");
    await prober.telemetry.record(spendLimitTurn, probe);

    expect(upstash.get("limit:spend")).toBe("2026-10-27T13:05:01.000Z");
    clock = new Date("2026-10-27T14:05:00.999Z");
    expect(await functionInstance().budget.reserve()).toEqual({ ok: false, errorCode: "SPEND_LIMIT" });
    clock = new Date("2026-10-27T14:05:01.000Z");
    expect(await functionInstance().budget.reserve()).toEqual({ ok: true, reservation: expect.any(String) });
  });

  test("a turn that reserved before the marker, and ends after it with an answer, leaves the marker: only the probe deletes it", async () => {
    clock = new Date("2026-10-27T11:59:00.000Z");
    const ops = functionInstance();
    const longTurn = await reserveOn(ops);
    const limitedTurn = await reserveOn(ops);
    clock = new Date("2026-10-27T12:00:00.000Z");
    await ops.telemetry.record(spendLimitTurn, limitedTurn);

    clock = new Date("2026-10-27T12:01:00.000Z");
    await ops.telemetry.record(answeredTurn, longTurn);

    expect(upstash.get("limit:spend")).toBe("2026-10-27T12:00:00.000Z");
    expect(await functionInstance().budget.reserve()).toEqual({ ok: false, errorCode: "SPEND_LIMIT" });
  });

  test("a probe that ends before its first model call leaves the marker, and the next UTC hour lets one more probe through", async () => {
    const first = functionInstance();
    await first.telemetry.record(spendLimitTurn, await reserveOn(first));
    clock = new Date("2026-10-27T13:10:00.000Z");
    const prober = functionInstance();
    const probe = await reserveOn(prober);
    // The visitor stopped the turn before the run started: no model call, no tokens.
    const stoppedFirst: ChatTurnEvent = { ...spendLimitTurn, outcome: "stopped", modelCalls: 0, errorCode: null };

    await prober.telemetry.record(stoppedFirst, probe);

    expect(upstash.get("limit:spend")).toBe("2026-10-27T12:00:00.000Z");
    // The hour's probe is taken.
    clock = new Date("2026-10-27T13:59:59.999Z");
    expect(await functionInstance().budget.reserve()).toEqual({ ok: false, errorCode: "SPEND_LIMIT" });
    clock = new Date("2026-10-27T14:00:00.000Z");
    const tickets = await Promise.all([functionInstance().budget.reserve(), functionInstance().budget.reserve()]);
    expect(tickets.filter((ticket) => ticket.ok)).toHaveLength(1);
  });

  // Each probe's model call started, and none finished: the token counts are null.
  test.each([
    ["a server error", { outcome: "error", errorCode: "SERVER_ERROR" }],
    ["the deadline", { outcome: "error", errorCode: "DEADLINE" }],
    ["an abort", { outcome: "stopped", errorCode: null }],
    ["a rate limit", { outcome: "error", errorCode: "429" }],
  ] as const)(
    "a probe whose model call started but did not finish, after %s, leaves limit:spend, and the next UTC hour lets one more probe through",
    async (_label, ending) => {
      const first = functionInstance();
      await first.telemetry.record(spendLimitTurn, await reserveOn(first));
      clock = new Date("2026-10-27T13:10:00.000Z");
      const prober = functionInstance();
      const probe = await reserveOn(prober);

      await prober.telemetry.record({ ...spendLimitTurn, ...ending, modelCalls: 1 }, probe);

      // No call finished, so the probe says nothing about the limit now.
      expect(upstash.get("limit:spend")).toBe("2026-10-27T12:00:00.000Z");
      clock = new Date("2026-10-27T13:30:00.000Z");
      expect(await functionInstance().budget.reserve()).toEqual({ ok: false, errorCode: "SPEND_LIMIT" });
      clock = new Date("2026-10-27T14:00:00.000Z");
      expect(await functionInstance().budget.reserve()).toEqual({ ok: true, reservation: expect.any(String) });
    },
  );

  test("turns that meet the limit on 3 function instances push one urgent spendlimit that day, with the wording draft's text; the next UTC day's first one pushes again", async () => {
    const instances = [functionInstance(), functionInstance(), functionInstance()];
    const reservations = await Promise.all(instances.map(reserveOn));

    await Promise.all(instances.map((ops, index) => ops.telemetry.record(spendLimitTurn, reservations[index])));

    expect(ntfy.pushes).toEqual([
      {
        topic: "resume-alerts-in-test",
        priority: 5,
        title: "Chat paused at Anthropic's monthly limit for October",
        message: "Raise the limit in the Anthropic Console, then in src/ops/limits.ts. The chat tries again within an hour.",
        headers: expect.any(Object),
      },
    ]);
    expect(upstash.expiresAt("alert:spendlimit:2026-10-27")).toEqual(new Date("2026-10-28T00:00:00.000Z"));

    // The next day's first probe meets the limit again.
    clock = new Date("2026-10-28T09:00:00.000Z");
    const prober = functionInstance();
    await prober.telemetry.record(spendLimitTurn, await reserveOn(prober));

    expect(ntfy.pushes).toHaveLength(2);
    expect(upstash.expiresAt("alert:spendlimit:2026-10-28")).toEqual(new Date("2026-10-29T00:00:00.000Z"));
  });
});
