// Seam 2 of SPEC-deploy: the ops module through createOps(), against the in-test Upstash server and
// a fixed clock (Testing Strategy; decision record row 117).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { questionLogContract } from "../../chat/server/__tests__/question-log-contract";
import { createOps } from "../ops";
import { startFakeUpstash, type FakeUpstash } from "./fake-upstash";

/** 2026-10-27 at noon UTC, the day the specs write their examples for. */
const noon = () => new Date("2026-10-27T12:00:00.000Z");

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
  ])("with PREVIEW_LIMIT=%s, the budget refuses every turn with %s", async (previewLimit, errorCode) => {
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
});

describe("createOps() in production", () => {
  let upstash: FakeUpstash;
  beforeEach(() => {
    upstash = startFakeUpstash();
  });
  afterEach(async () => {
    await upstash.stop();
  });

  test.each(["day", "month", "daily"])("ignores PREVIEW_LIMIT=%s: the budget allows the turn", async (previewLimit) => {
    const ops = createOps(
      { VERCEL_ENV: "production", KV_REST_API_URL: upstash.url, KV_REST_API_TOKEN: "test", PREVIEW_LIMIT: previewLimit },
      { now: noon },
    );

    expect(await ops.budget.reserve()).toEqual({ ok: true, reservation: expect.any(String) });
  });
});

describe("guards", () => {
  let upstash: FakeUpstash;
  beforeEach(() => {
    upstash = startFakeUpstash();
  });
  afterEach(async () => {
    await upstash.stop();
  });

  test.each(["preview", "development", undefined])(
    "with VERCEL_ENV %p and the store and alert variables set, a whole turn calls no server",
    async (vercelEnv) => {
      // The store and alert variables point at the in-test server, so a store call or a push would show there.
      const ops = createOps(
        {
          VERCEL_ENV: vercelEnv,
          KV_REST_API_URL: upstash.url,
          KV_REST_API_TOKEN: "test",
          NTFY_TOPIC_URL: `${upstash.url}/topic`,
          ANTHROPIC_API_KEY: "test",
        },
        { now: noon },
      );

      const ticket = await ops.budget.reserve();
      await ops.log.append({
        id: "entry-1",
        date: "2026-10-27",
        question: "How did FedNow's bundle get under 1 MB?",
        read: ["fednow-bundle-size"],
        citations: ["fednow-bundle-size.2"],
        removed: 0,
        outcome: "answered",
      });
      await ops.telemetry.record(
        {
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
        },
        ticket.ok ? ticket.reservation : undefined,
      );
      await ops.log.list(7);

      expect(upstash.requests).toEqual([]);
    },
  );
});
