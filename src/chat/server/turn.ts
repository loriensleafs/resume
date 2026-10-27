// One turn's state (SPEC-chat, One turn): handleChat() makes one for each request, each middleware
// writes the facts it learns into it, and finishTurn() reads it once, at the end of the turn.

/** The summed token counts of a turn's model calls that finished, as SPEC-deploy maps them. */
export type TokenCounts = {
  inputTokens: number; // uncached input only
  cachedInputTokens: number; // cache reads
  cacheWriteTokens: number; // all cache writes, the 1-hour ones included
  cacheWrite1hTokens: number;
  outputTokens: number;
};

export type Turn = {
  /** The newest question's text as sent. */
  readonly question: string;
  readonly startedAt: Date;
  /** The budget's reservation; none when the budget refused the turn. */
  readonly reservation: string | undefined;
  /** The source and passage ids read this turn: the log entry's `read`. */
  readonly readIds: string[];
  /** The turn's reads: its read_sources calls that ran. */
  reads: number;
  /** The kept citations, in order of first use. */
  readonly citations: string[];
  /** The markers the check removed. */
  removed: number;
  /** The model calls that started. */
  modelCalls: number;
  /** The counts of the model calls that finished; null until one finishes. */
  tokens: TokenCounts | null;
};

/** A turn that has read, cited and called nothing yet. */
export function startTurn(turn: Pick<Turn, "question" | "startedAt" | "reservation">): Turn {
  return { ...turn, readIds: [], reads: 0, citations: [], removed: 0, modelCalls: 0, tokens: null };
}
