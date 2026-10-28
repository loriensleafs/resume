// The chat server's own log lines for a failure (SPEC-chat, The request, "A thrown run"): a line holds
// the error alone, never the question, a log entry or the thinking summary. An error's message and
// stack can repeat what the failed call was given (a store that echoes its payload does), so the line
// keeps only the error's name and code.

import type { DebugConfig } from "@tanstack/ai";

/** A name or a code that is one short word, so it cannot carry text. */
const WORD = /^[A-Za-z0-9_.:-]{1,64}$/;

/** Logs that `what` failed, with the error's name and code only. */
export function logServerError(what: string, error: unknown): void {
  console.error(`${what}: ${errorKind(error)}`);
}

function errorKind(error: unknown): string {
  if (!(error instanceof Error)) return `a thrown ${typeof error}`;
  const name = WORD.test(error.name) ? error.name : "Error";
  const code: unknown = Reflect.get(error, "code");
  return (typeof code === "string" || typeof code === "number") && WORD.test(String(code)) ? `${name} (code ${code})` : name;
}

/**
 * TanStack AI's own log lines, for chat()'s `debug` option. By default the library prints each error it
 * catches with its data: the whole error, its message and stack included, and the threadId. Here its
 * error lines keep the same rule as the chat's own: the library's fixed text and the error's name and
 * code only. Its warnings keep their fixed text, and its other categories, which print chunks and
 * requests, stay off. A category that a later version adds goes to `debug`, which prints nothing.
 */
export const libraryLogging: DebugConfig = {
  logger: {
    debug: () => {},
    info: () => {},
    warn: (message) => console.warn(message),
    error: (message, meta) => logServerError(message, meta?.error),
  },
  errors: true,
  provider: false,
  output: false,
  middleware: false,
  tools: false,
  agentLoop: false,
  config: false,
  request: false,
  sandbox: false,
};
