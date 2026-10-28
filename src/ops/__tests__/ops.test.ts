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

  test.each(["day", "month", "daily"])("in production, PREVIEW_LIMIT=%s is ignored: the budget allows the turn", async (previewLimit) => {
    // The budget calls no server yet: production keeps its in-memory interim budget (ops.ts) until
    // D11. The variables are here so that this test runs on the store-backed path once D11 builds it.
    const ops = createOps({ VERCEL_ENV: "production", PREVIEW_LIMIT: previewLimit, ...storeAndAlerts() }, { now: noon });

    expect(await ops.budget.reserve()).toEqual({ ok: true, reservation: expect.any(String) });
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
