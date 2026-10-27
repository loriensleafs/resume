// The chat server's own log lines for a failure (SPEC-chat, The request, "A thrown run"): a line holds
// the error alone, never the question, a log entry or the thinking summary. An error's message and
// stack can repeat what the failed call was given (a store that echoes its payload does), so the line
// keeps only the error's name and code.

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
