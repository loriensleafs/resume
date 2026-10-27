// Seam 1 of SPEC-chat: handleChat() with the fake model, knowledge built from fixtures, and the
// in-memory log, budget and telemetry (decision record row 83). Until handleChat() exists (C3),
// it runs the QuestionLog contract suite and checks the in-memory parts that it passes as ChatDeps.

import { describe, expect, test } from "bun:test";
import { questionLogContract } from "./question-log-contract";
import { inMemoryBudget, inMemoryQuestionLog, inMemoryTelemetry } from "../question-log";
import type { ChatTurnEvent } from "../telemetry";

questionLogContract("in-memory", (now) => inMemoryQuestionLog(now));

describe("the in-memory budget", () => {
  test("allows a turn, with a reservation", async () => {
    expect(await inMemoryBudget().reserve()).toEqual({ ok: true, reservation: expect.any(String) });
  });

  test.each(["DAILY_LIMIT", "SPEND_LIMIT"] as const)("refuses every turn with %s when it is given that code", async (code) => {
    const budget = inMemoryBudget(code);

    expect(await budget.reserve()).toEqual({ ok: false, errorCode: code });
    expect(await budget.reserve()).toEqual({ ok: false, errorCode: code });
  });
});

describe("the in-memory telemetry", () => {
  test("keeps each chat_turn event, in the order recorded", async () => {
    const telemetry = inMemoryTelemetry();
    const answered: ChatTurnEvent = {
      event: "chat_turn",
      outcome: "answered",
      reads: 1,
      citations: 2,
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
    const refused: ChatTurnEvent = {
      event: "chat_turn",
      outcome: "limit",
      reads: 0,
      citations: 0,
      removed: 0,
      modelCalls: 0,
      inputTokens: null,
      cachedInputTokens: null,
      cacheWriteTokens: null,
      cacheWrite1hTokens: null,
      outputTokens: null,
      durationMs: 12,
      errorCode: "DAILY_LIMIT",
    };

    await telemetry.record(answered, "reservation-1");
    await telemetry.record(refused);

    expect(telemetry.events).toEqual([answered, refused]);
  });
});
