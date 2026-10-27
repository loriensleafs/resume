// Seam 1 of SPEC-chat: handleChat() with the fake model, knowledge built from fixtures (one fixture
// source has Not public text), and the in-memory log, budget and telemetry (decision record row 83).
// Each test sends a request the way the browser does and reads the server-sent events, the log and
// the telemetry events.

import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { uiMessagesToWire, type TextOptions, type UIMessage } from "@tanstack/ai";
import { fakeText } from "@tanstack/ai/testing";
import { buildKnowledge } from "../../../knowledge/build";
import { renderCore } from "../../../knowledge/render";
import { deepDiveFile, fixture, removeFixtures } from "../../../knowledge/__tests__/fixtures";
import type { Knowledge } from "../../../knowledge/types";
import { handleChat, type ChatDeps } from "../handle-chat";
import { inMemoryBudget, inMemoryQuestionLog, inMemoryTelemetry, type Budget, type QuestionLog, type Telemetry } from "../question-log";
import type { ChatTurnEvent } from "../telemetry";
import { questionLogContract } from "./question-log-contract";

questionLogContract("in-memory", (now) => inMemoryQuestionLog(now));

/** The browser's conversation id: a UUID, used only for prompt caching (SPEC-chat, The request). */
const THREAD_ID = "6b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
/** Noon on 2026-10-27, UTC. */
const now = () => new Date("2026-10-27T12:00:00.000Z");

let knowledge: Knowledge;

beforeAll(async () => {
  // The knowledge module's fixtures: a resume with the role acme and its two highlights, one
  // approved logistics answer, and the deep dive `sample`, whose Not public section holds text.
  const root = await fixture("chat-seam-1", {
    "knowledge/logistics.yaml": `topics:
  - topic: work-arrangement
    answer: Remote, or on-site in Boston.
    status: approved
    approved: 2026-10-27
`,
    "knowledge/sources/sample.md": deepDiveFile(),
  });
  knowledge = await buildKnowledge({ root });
});

afterAll(removeFixtures);

const question = (text: string): UIMessage => ({ id: crypto.randomUUID(), role: "user", parts: [{ type: "text", content: text }] });
const answer = (text: string): UIMessage => ({ id: crypto.randomUUID(), role: "assistant", parts: [{ type: "text", content: text }] });

/** A POST /api/chat as TanStack AI's browser client builds it (ai-client's buildRunAgentInputBody). */
function chatRequest(messages: UIMessage[]): Request {
  return new Request("https://peterkloss.dev/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      threadId: THREAD_ID,
      runId: crypto.randomUUID(),
      state: {},
      messages: uiMessagesToWire(messages),
      tools: [],
      context: [],
      forwardedProps: {},
    }),
  });
}

/** The ChatDeps of seam 1, with the given fake model. */
function seamDeps(adapter: ChatDeps["adapter"], overrides: Partial<ChatDeps> = {}) {
  return {
    adapter,
    knowledge,
    log: inMemoryQuestionLog(now),
    budget: inMemoryBudget(),
    telemetry: inMemoryTelemetry(),
    origins: [],
    now,
    ...overrides,
  } satisfies ChatDeps;
}

type WireEvent = { type: string; [key: string]: unknown };

/** Every server-sent event of a response, in order. Reading them all ends the response. */
async function readEvents(response: Response): Promise<WireEvent[]> {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter((block) => block.startsWith("data: "))
    .map((block) => JSON.parse(block.slice("data: ".length)) as WireEvent);
}

/** The answer text as the browser receives it: every TEXT_MESSAGE_CONTENT delta, joined. */
const streamedText = (events: WireEvent[]) =>
  events
    .filter((e) => e.type === "TEXT_MESSAGE_CONTENT")
    .map((e) => e.delta)
    .join("");

/** The values of the chat.citations events. */
const citationEvents = (events: WireEvent[]) => events.filter((e) => e.type === "CUSTOM" && e.name === "chat.citations").map((e) => e.value);

describe("citations", () => {
  test("an answer with no read keeps a resume citation in the streamed text, and chat.citations lists it with 0 removed", async () => {
    const fake = fakeText();
    const text = "Test Person built the first thing at Acme [highlight:acme.1].";
    fake.setResponses([{ text }]);

    const events = await readEvents(await handleChat(chatRequest([question("What did Test Person build at Acme?")]), seamDeps(fake)));

    expect(streamedText(events)).toBe(text);
    expect(citationEvents(events)).toEqual([{ citations: ["highlight:acme.1"], removed: 0 }]);
  });

  test("a citation of a resume entry that does not exist leaves the streamed text and is counted as removed", async () => {
    const fake = fakeText();
    fake.setResponses([{ text: "Test Person works at Acme [role:acme] and led its migration [highlight:acme.9]." }]);

    const events = await readEvents(await handleChat(chatRequest([question("What did Test Person lead at Acme?")]), seamDeps(fake)));

    expect(streamedText(events)).toBe("Test Person works at Acme [role:acme] and led its migration .");
    expect(citationEvents(events)).toEqual([{ citations: ["role:acme"], removed: 1 }]);
  });
});

// fakeText() streams every answer in TEXT_MESSAGE_CONTENT events of 4 characters each
// (@tanstack/ai/testing, chunksOf()), so each marker below reaches the handler split over several
// events. The streamed deltas show what the marker middleware held.
describe("markers: holding", () => {
  /** The deltas of the TEXT_MESSAGE_CONTENT events, as the browser receives them. */
  const deltas = (events: WireEvent[]) => events.filter((e) => e.type === "TEXT_MESSAGE_CONTENT").map((e) => String(e.delta));

  test("a citation marker split over text events is held and checked whole", async () => {
    const fake = fakeText();
    fake.setResponses([{ text: "Test Person built the first thing [highlight:acme.1] and planned the next [role:nobody]." }]);

    const events = await readEvents(await handleChat(chatRequest([question("What did Test Person build?")]), seamDeps(fake)));

    expect(streamedText(events)).toBe("Test Person built the first thing [highlight:acme.1] and planned the next .");
    expect(deltas(events)).toContain("[highlight:acme.1]");
    expect(deltas(events).some((delta) => delta.includes("nobody"))).toBe(false);
    expect(citationEvents(events)).toEqual([{ citations: ["highlight:acme.1"], removed: 1 }]);
  });

  test("text from an open [ passes as text once it is past 120 characters, before the bracket closes", async () => {
    const fake = fakeText();
    const text = `Test Person wrote [${"a".repeat(150)}] once.`;
    fake.setResponses([{ text }]);

    const events = await readEvents(await handleChat(chatRequest([question("What did Test Person write?")]), seamDeps(fake)));

    expect(streamedText(events)).toBe(text);
    const opening = deltas(events).find((delta) => delta.includes("["));
    expect(opening).not.toContain("]");
    expect(citationEvents(events)).toEqual([{ citations: [], removed: 0 }]);
  });

  test("text held at the end of a message is flushed as text", async () => {
    const fake = fakeText();
    const text = "Test Person built the first thing [highlight:acme";
    fake.setResponses([{ text }]);

    const events = await readEvents(await handleChat(chatRequest([question("What did Test Person build?")]), seamDeps(fake)));

    expect(streamedText(events)).toBe(text);
    expect(citationEvents(events)).toEqual([{ citations: [], removed: 0 }]);
  });
});

describe("the model request", () => {
  test("holds the system prompt with the rendered core, then the earlier turns and the question", async () => {
    const fake = fakeText();
    const requests: TextOptions[] = [];
    fake.setResponses([
      ({ request }) => {
        requests.push(request);
        return { text: "Test Person built the second thing [highlight:acme.2]." };
      },
    ]);

    await readEvents(
      await handleChat(
        chatRequest([question("Where does Test Person work?"), answer("At Acme [role:acme]."), question("What else did Test Person build?")]),
        seamDeps(fake),
      ),
    );

    expect(requests).toHaveLength(1);
    const [request] = requests;
    const prompts = (request?.systemPrompts ?? []).map((prompt) => (typeof prompt === "string" ? prompt : prompt.content));
    expect(prompts.some((prompt) => prompt.includes(renderCore(knowledge)))).toBe(true);
    expect(request?.messages.map(({ role, content }) => ({ role, content }))).toEqual([
      { role: "user", content: "Where does Test Person work?" },
      { role: "assistant", content: "At Acme [role:acme]." },
      { role: "user", content: "What else did Test Person build?" },
    ]);
  });
});

describe("limits", () => {
  test.each(["DAILY_LIMIT", "SPEND_LIMIT"] as const)(
    "a budget that refuses with %s gives a 200 stream with one RUN_ERROR event with that code, no model call and no log entry",
    async (code) => {
      const fake = fakeText();
      fake.setResponses([{ text: "Test Person built the first thing [highlight:acme.1]." }]);
      const deps = seamDeps(fake, { budget: inMemoryBudget(code) });

      const response = await handleChat(chatRequest([question("What did Test Person build?")]), deps);
      const events = await readEvents(response);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/event-stream");
      expect(events).toEqual([{ type: "RUN_ERROR", code, message: expect.any(String), timestamp: expect.any(Number) }]);
      expect(fake.state.callCount).toBe(0);
      expect(await deps.log.list(1)).toEqual([]);
    },
  );
});

describe("turn telemetry", () => {
  /** Telemetry that keeps each chat_turn event with the reservation it was recorded with. */
  function recordingTelemetry() {
    const records: { event: ChatTurnEvent; reservation: string | undefined }[] = [];
    return {
      records,
      async record(event: ChatTurnEvent, reservation?: string) {
        records.push({ event, reservation });
      },
    } satisfies Telemetry & { records: unknown };
  }

  test("an answered turn hands one chat_turn event, with its reservation and the finished call's usage, to telemetry.record()", async () => {
    const fake = fakeText();
    // 101 characters: the fake counts ceil(101 / 4) = 26 output tokens.
    fake.setResponses([{ text: "Test Person works at Acme [role:acme] and built the first thing [highlight:acme.1][highlight:acme.9]." }]);
    const telemetry = recordingTelemetry();
    const deps = seamDeps(fake, { telemetry, budget: { reserve: async () => ({ ok: true, reservation: "reservation-1" }) } });

    await readEvents(await handleChat(chatRequest([question("Where does Test Person work?")]), deps));

    expect(telemetry.records).toEqual([
      {
        event: {
          event: "chat_turn",
          outcome: "answered",
          reads: 0,
          citations: 2,
          removed: 1,
          modelCalls: 1,
          inputTokens: expect.any(Number),
          cachedInputTokens: 0,
          cacheWriteTokens: 0,
          cacheWrite1hTokens: 0,
          outputTokens: 26,
          durationMs: 0,
          errorCode: null,
        },
        reservation: "reservation-1",
      },
    ]);
    expect(telemetry.records[0]?.event.inputTokens).toBeGreaterThan(0);
    expect(JSON.stringify(telemetry.records)).not.toContain("Where does Test Person work?");
    expect(JSON.stringify(telemetry.records)).not.toContain(THREAD_ID);
  });

  test("a refusal whose code is no known code puts SERVER_ERROR on the wire and in the telemetry, and never the error's message or stack", async () => {
    // A budget from another module that hands back an error's text as its code.
    const thrown = new Error("boom: the budget store failed");
    const budget = { reserve: async () => ({ ok: false, errorCode: String(thrown.stack) }) } as unknown as Budget;
    const telemetry = recordingTelemetry();

    const events = await readEvents(await handleChat(chatRequest([question("What did Test Person build?")]), seamDeps(fakeText(), { budget, telemetry })));

    expect(events).toEqual([{ type: "RUN_ERROR", code: "SERVER_ERROR", message: expect.any(String), timestamp: expect.any(Number) }]);
    expect(telemetry.records.map((record) => record.event.errorCode)).toEqual(["SERVER_ERROR"]);
    const everything = JSON.stringify({ events, records: telemetry.records });
    expect(everything).not.toContain("boom");
    expect(everything).not.toContain("handle-chat.test.ts");
  });

  test.each(["DAILY_LIMIT", "SPEND_LIMIT"] as const)(
    "a turn the budget refuses with %s hands one chat_turn event, limit with that code, with no model call and no token counts",
    async (code) => {
      const telemetry = recordingTelemetry();
      const deps = seamDeps(fakeText(), { telemetry, budget: inMemoryBudget(code) });

      await readEvents(await handleChat(chatRequest([question("What did Test Person build?")]), deps));

      expect(telemetry.records).toEqual([
        {
          event: {
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
            durationMs: 0,
            errorCode: code,
          },
          reservation: undefined,
        },
      ]);
    },
  );
});

describe("the question log", () => {
  test("an answered turn writes one answered entry with the UTC day, the question and the kept citations, and no threadId, after the run ends", async () => {
    const fake = fakeText();
    fake.setResponses([{ text: "Test Person works remotely [logistics:work-arrangement]. Test Person built the first thing [highlight:acme.1]." }]);
    const deps = seamDeps(fake);

    const response = await handleChat(chatRequest([question("Does Test Person work remotely?")]), deps);
    expect(await deps.log.list(1)).toEqual([]);
    await readEvents(response);

    const entries = await deps.log.list(1);
    expect(entries).toEqual([
      {
        id: expect.any(String),
        date: "2026-10-27",
        question: "Does Test Person work remotely?",
        read: [],
        citations: ["logistics:work-arrangement", "highlight:acme.1"],
        removed: 0,
        outcome: "answered",
      },
    ]);
    expect(JSON.stringify(entries)).not.toContain(THREAD_ID);
  });

  test("two turns with the same log and telemetry write one entry and one chat_turn event each", async () => {
    const fake = fakeText();
    fake.setResponses([{ text: "At Acme [role:acme]." }, { text: "The first thing [highlight:acme.1]." }]);
    const telemetry = inMemoryTelemetry();
    const deps = seamDeps(fake, { telemetry });

    await readEvents(await handleChat(chatRequest([question("Where does Test Person work?")]), deps));
    await readEvents(await handleChat(chatRequest([question("What did Test Person build?")]), deps));

    expect((await deps.log.list(1)).map((entry) => [entry.question, entry.citations])).toEqual([
      ["What did Test Person build?", ["highlight:acme.1"]],
      ["Where does Test Person work?", ["role:acme"]],
    ]);
    expect(telemetry.events.map((event) => [event.outcome, event.citations])).toEqual([
      ["answered", 1],
      ["answered", 1],
    ]);
  });

  test("a question-log write that fails never breaks the answer, and the server's log line holds neither the question nor the error's message", async () => {
    const fake = fakeText();
    const text = "Test Person built the first thing [highlight:acme.1].";
    fake.setResponses([{ text }]);
    const asked = "What did Test Person build at Acme?";
    // A store whose error repeats the entry it was given, question included.
    const log: QuestionLog = {
      append: async (entry) => {
        throw new Error(`the store refused ${JSON.stringify(entry)}`);
      },
      list: async () => [],
    };
    const telemetry = inMemoryTelemetry();
    const consoleError = spyOn(console, "error").mockImplementation(() => {});

    try {
      const events = await readEvents(await handleChat(chatRequest([question(asked)]), seamDeps(fake, { log, telemetry })));

      expect(streamedText(events)).toBe(text);
      expect(events.at(-1)?.type).toBe("RUN_FINISHED");
      expect(telemetry.events.map((event) => event.outcome)).toEqual(["answered"]);
      const lines = consoleError.mock.calls.map((args) => args.map(String).join(" "));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain("question-log");
      expect(lines[0]).not.toContain(asked);
      expect(lines[0]).not.toContain("the store refused");
    } finally {
      consoleError.mockRestore();
    }
  });
});
