// The ops module (SPEC-deploy, "The question log, daily totals, alerts and status"). It gives the
// chat's route file the question log, budget and telemetry that SPEC-chat defines, and the daily
// totals. Outside production they are the chat module's in-memory versions, whatever variables are
// set, so a preview never reaches the store or sends an alert (decision record row 108). In
// production the telemetry prints each turn's chat_turn line, and with the store set, the log, the
// budget, the telemetry and the totals are the store's (upstash.ts, daily-totals.ts), and the budget
// and the telemetry raise the limit alerts (alerts.ts).

import {
  inMemoryBudget,
  inMemoryQuestionLog,
  inMemoryTelemetry,
  type Budget,
  type QuestionLog,
  type Telemetry,
} from "../chat/server/question-log";
import type { ChatTurnEvent } from "../chat/server/telemetry";
import { limitAlerts } from "./alerts";
import { upstashTelemetry, upstashTotals, type DailyTotals } from "./daily-totals";
import { upstashBudget, upstashQuestionLog } from "./upstash";
import { upstashStore } from "./upstash-rest";

export type { DailyTotals } from "./daily-totals";

/** What createOps() reads from the environment. `process.env` fits it as it is (see the declaration below). */
export type OpsEnv = {
  VERCEL_ENV?: string; // the store and alerts are used only in "production"
  KV_REST_API_URL?: string; // set by the Upstash integration, Production only
  KV_REST_API_TOKEN?: string;
  NTFY_TOPIC_URL?: string; // https://ntfy.sh/<secret topic>
  ANTHROPIC_API_KEY?: string; // only whether it is set is read, for status()
  PREVIEW_LIMIT?: string; // "day" or "month", outside production only: the budget refuses every turn with
                          // DAILY_LIMIT or SPEND_LIMIT, so a preview can show the "limit reached" state
};

// process.env's type declares these variables, as Bun's docs say to type them ("Environment variables", TypeScript).
// Without it, TypeScript refuses `createOps(process.env)`: process.env's type declares only NODE_ENV and TZ, and a type
// of optional fields only must share one of them (the weak-type check, TS2559). With it, OpsEnv needs no index
// signature, so a misspelled key in a `createOps({...})` call fails the type check.
declare module "bun" {
  interface Env extends OpsEnv {}
}

/** The parts the chat's route file passes to handleChat() as ChatDeps, and the daily totals. */
export type Ops = {
  log: QuestionLog;
  budget: Budget;
  telemetry: Telemetry;
  /** The daily totals of the last `days` UTC days, today included, newest first. */
  totals(days: number): Promise<DailyTotals[]>;
};

/**
 * Builds the ops parts from the environment. Each call gives new, empty parts, so the route file
 * builds them once per function instance.
 *
 * - Outside production (any `VERCEL_ENV` but "production"): the chat module's in-memory log, budget
 *   and telemetry, whatever other variables are set, and no daily totals. `PREVIEW_LIMIT` "day" or
 *   "month" makes the budget refuse every turn; an empty value counts as unset; any other value throws.
 * - In production, `PREVIEW_LIMIT` is ignored, whatever its value, and `record()` prints each turn's
 *   chat_turn line through `io.print`, the function log by default. With `KV_REST_API_URL` and
 *   `KV_REST_API_TOKEN` both set, the log, the budget, the telemetry and the totals are the store's,
 *   and each store call goes through `io.fetch`. With `NTFY_TOPIC_URL` also set, a DAILY_LIMIT refusal
 *   and a month's estimate past 75% of the limit push their limit alerts, through `io.fetch` too, and
 *   a failed push prints an ops_error line through `io.print`. Without both store variables, the log
 *   and the budget stay in memory, the budget allows every turn, and there are no daily totals or
 *   alerts, so answers keep working (SPEC-deploy, "A setting is missing in production").
 */
export function createOps(
  env: OpsEnv,
  io: { fetch?: typeof fetch; now?: () => Date; print?: (line: string) => void } = {},
): Ops {
  const now = io.now ?? (() => new Date());
  if (env.VERCEL_ENV !== "production") {
    return inMemoryOps(now, previewRefusal(env.PREVIEW_LIMIT));
  }
  const print = io.print ?? console.log;
  if (!env.KV_REST_API_URL || !env.KV_REST_API_TOKEN) {
    return { ...inMemoryOps(now), telemetry: printedTelemetry(print) };
  }
  const fetchFn = io.fetch ?? fetch;
  const store = upstashStore({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN, fetch: fetchFn });
  const alerts = limitAlerts({ topicUrl: env.NTFY_TOPIC_URL, store, fetch: fetchFn, now, print });
  return {
    log: upstashQuestionLog(store, now),
    budget: upstashBudget(store, now, alerts.dayCapped),
    telemetry: printedTelemetry(print, upstashTelemetry(store, alerts.monthCost)),
    totals: upstashTotals(store, now),
  };
}

/**
 * Production's telemetry: `record()` prints the turn's chat_turn line to the function log, then hands
 * the turn to the store's telemetry, when the store is set. The line comes first, so it shows also
 * when the store fails.
 */
function printedTelemetry(print: (line: string) => void, store?: Telemetry): Telemetry {
  return {
    async record(event, reservation) {
      print(chatTurnLine(event));
      await store?.record(event, reservation);
    },
  };
}

/**
 * The chat_turn line: the event's thirteen fields as JSON, and nothing else. An object with more
 * fields, such as a threadId, still fits the type at run time, and no line holds a field that
 * SPEC-chat leaves out.
 */
function chatTurnLine(event: ChatTurnEvent): string {
  const { outcome, reads, citations, removed, modelCalls, durationMs, errorCode } = event;
  const { inputTokens, cachedInputTokens, cacheWriteTokens, cacheWrite1hTokens, outputTokens } = event;
  return JSON.stringify({
    event: "chat_turn",
    outcome,
    reads,
    citations,
    removed,
    modelCalls,
    inputTokens,
    cachedInputTokens,
    cacheWriteTokens,
    cacheWrite1hTokens,
    outputTokens,
    durationMs,
    errorCode,
  } satisfies ChatTurnEvent);
}

function inMemoryOps(now: () => Date, refusal?: "DAILY_LIMIT" | "SPEND_LIMIT"): Ops {
  return {
    log: inMemoryQuestionLog(now),
    budget: inMemoryBudget(refusal),
    telemetry: inMemoryTelemetry(),
    // Only the store keeps daily totals, so the in-memory parts have none.
    totals: async () => [],
  };
}

/** The most characters of an unknown PREVIEW_LIMIT that the error shows, in case a secret went into it by mistake. */
const shownCharacters = 32;

/** The code the budget refuses every turn with outside production, from PREVIEW_LIMIT. */
function previewRefusal(previewLimit: string | undefined): "DAILY_LIMIT" | "SPEND_LIMIT" | undefined {
  switch (previewLimit) {
    case undefined:
    case "":
      return undefined;
    case "day":
      return "DAILY_LIMIT";
    case "month":
      return "SPEND_LIMIT";
    default: {
      const characters = [...previewLimit];
      const shown =
        characters.length > shownCharacters
          ? `${JSON.stringify(characters.slice(0, shownCharacters).join(""))} (cut to ${shownCharacters} characters)`
          : JSON.stringify(previewLimit);
      throw new Error(`PREVIEW_LIMIT is ${shown}; outside production it must be "day", "month" or unset.`);
    }
  }
}
