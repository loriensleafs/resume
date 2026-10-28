// The run of one turn (SPEC-chat, How a turn ends; The request, "A thrown run"): the run's controller,
// which the visitor's Stop aborts, and the stream wrapper around the chat() stream, which sends the
// handler's own RUN_ERROR when the run threw or passed its deadline.

import type { StreamChunk } from "@tanstack/ai";
import type { TurnEnding } from "./finish-turn";
import { passedDeadline } from "./limits";
import { logServerError } from "./server-log";
import { wireError } from "./wire";

/**
 * The run's controller, which the visitor's Stop aborts (How a turn ends): the first of `signals` to
 * abort reaches the model call through chat(). On Vercel the request's signal never fires (row 168),
 * and SPEC-deploy owns that case ("A Stop on Vercel"); this code only reacts where the signal fires.
 */
export function stoppedBy(...signals: AbortSignal[]): AbortController {
  const run = new AbortController();
  const stop = AbortSignal.any(signals);
  if (stop.aborted) run.abort();
  else stop.addEventListener("abort", () => run.abort(), { once: true });
  return run;
}

/**
 * The stream wrapper: the chat() stream, ended with the handler's own RUN_ERROR when the turn ended
 * with an error the browser must see. `run` is the run's abort signal, and `endTurn` ends the turn
 * through finishTurn(), which writes nothing when the turn already ended.
 *
 * - A thrown run (The request, "A thrown run"). A throw out of the chat() stream never passes the
 *   chunk middleware, and toServerSentEventsResponse() would send the error's own message. So a throw
 *   becomes wireError("SERVER_ERROR"), the real error is logged on the server only, and the turn ends
 *   as error. An abort is not a throw of this kind: the abort decides how the turn ends.
 * - A throw after a Stop. The Stop ends the turn as stopped. Mostly the run's terminal hook already
 *   ended it, but chat() can throw before its run starts (it reads the adapter and builds its engine
 *   first), and then no terminal hook runs: the turn ends here, so its reservation still settles.
 * - The deadline (Limits, "Deadline"). The deadline middleware ended the turn as error DEADLINE when it
 *   aborted the run. The stream then sends wireError("DEADLINE") before it closes, also when the run
 *   threw after the abort.
 */
export async function* wrapRun(
  stream: AsyncIterable<StreamChunk>,
  run: AbortSignal,
  endTurn: (ending: TurnEnding) => Promise<void>,
): AsyncGenerator<StreamChunk> {
  try {
    yield* stream;
  } catch (error) {
    if (!run.aborted) {
      logServerError("chat: the run threw, and the turn ends with SERVER_ERROR", error);
      await endTurn({ outcome: "error", errorCode: "SERVER_ERROR" });
      yield wireError("SERVER_ERROR");
      return;
    }
    // After the deadline's abort the turn has ended, and this writes nothing.
    await endTurn({ outcome: "stopped", errorCode: null });
  }
  if (passedDeadline(run)) yield wireError("DEADLINE");
}
