// The ops module (SPEC-deploy, "The question log, daily totals, alerts and status"). It gives the
// chat's route file the question log, budget and telemetry that SPEC-chat defines. Outside
// production they are the chat module's in-memory versions, whatever variables are set, so a
// preview never reaches the store or sends an alert (decision record row 108).

import {
  inMemoryBudget,
  inMemoryQuestionLog,
  inMemoryTelemetry,
  type Budget,
  type QuestionLog,
  type Telemetry,
} from "../chat/server/question-log";

/** What createOps() reads from the environment. `process.env` fits it as it is. */
export type OpsEnv = {
  VERCEL_ENV?: string; // the store and alerts are used only in "production"
  KV_REST_API_URL?: string; // set by the Upstash integration, Production only
  KV_REST_API_TOKEN?: string;
  NTFY_TOPIC_URL?: string; // https://ntfy.sh/<secret topic>
  ANTHROPIC_API_KEY?: string; // only whether it is set is read, for status()
  PREVIEW_LIMIT?: string; // "day" or "month", outside production only: the budget refuses every turn with
                          // DAILY_LIMIT or SPEND_LIMIT, so a preview can show the "limit reached" state
};

/** The parts the chat's route file passes to handleChat() as ChatDeps. */
export type Ops = {
  log: QuestionLog;
  budget: Budget;
  telemetry: Telemetry;
};

/**
 * Builds the ops parts from the environment. Each call gives new, empty parts, so the route file
 * builds them once per function instance.
 *
 * - Outside production (any `VERCEL_ENV` but "production"): the chat module's in-memory log, budget
 *   and telemetry, whatever other variables are set. `PREVIEW_LIMIT` "day" or "month" makes the
 *   budget refuse every turn; an empty value counts as unset; any other value throws.
 * - In production, `PREVIEW_LIMIT` is ignored, whatever its value.
 */
export function createOps(env: OpsEnv, io: { now?: () => Date } = {}): Ops {
  const now = io.now ?? (() => new Date());
  if (env.VERCEL_ENV !== "production") {
    return inMemoryOps(now, previewRefusal(env.PREVIEW_LIMIT));
  }
  // The interim: the store-backed parts (SPEC-deploy, "Store calls") are not built yet. Until D10,
  // D11 and D12 replace the log, the budget and the telemetry, production gets the in-memory parts
  // with a budget that allows every turn. A missing or failing store keeps answers working, and
  // Anthropic's monthly spend limit stays the backstop (SPEC-deploy, "The store fails").
  return inMemoryOps(now);
}

function inMemoryOps(now: () => Date, refusal?: "DAILY_LIMIT" | "SPEND_LIMIT"): Ops {
  return { log: inMemoryQuestionLog(now), budget: inMemoryBudget(refusal), telemetry: inMemoryTelemetry() };
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
