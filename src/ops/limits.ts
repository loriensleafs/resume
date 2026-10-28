// The spend limits that live in code (SPEC-deploy, "Spend limits" and "The daily cap"). A change to
// any value here is an ask-first change (SPEC-deploy, Boundaries). Every sum is in millionths of a
// dollar, the unit the store counts costs in, so the store adds whole numbers and never rounds.

/** A sum in dollars, as millionths of a dollar. */
const dollars = (amount: number): number => Math.round(amount * 1_000_000);

/**
 * What each turn reserves before its first model call, $0.90 (decision record rows 131 and 132): more
 * than the worst case of one turn under the size caps, so parallel turns cannot pass the daily cap.
 */
export const reservation = dollars(0.9);

/** The daily cap, $8 of estimated cost a UTC day (row 121). A reservation that would pass it is refused. */
export const dailyCap = dollars(8);

/**
 * Anthropic's monthly limit for the workspace `resume-chat`, $20 (row 113). Anthropic enforces the
 * limit itself, from the Console; this copy is what the spend75 alert measures the month against, so
 * a raise in the Console comes here too.
 */
export const monthlyLimit = dollars(20);

/** The share of the monthly limit that the month's estimate passes before the spend75 alert, 75% (rows 115 and 121). */
export const spendAlertShare = 0.75;

/**
 * Sonnet 5.5's prices in dollars per million tokens (SPEC-deploy, "Cost estimate"; research 11). A
 * dollar per million tokens is a millionth of a dollar per token, so each price is also one token's
 * cost in the unit the store counts in.
 */
export const pricesPerMillionTokens = {
  uncachedInput: 2,
  cacheReads: 0.1,
  cacheWrites5m: 2.5,
  cacheWrites1h: 4,
  output: 10,
} as const;

/** A turn's five token counts, as SPEC-chat's chat_turn event holds them. */
export type TurnTokens = {
  inputTokens: number; // uncached input only
  cachedInputTokens: number; // cache reads
  cacheWriteTokens: number; // all cache writes, the 1-hour ones included
  cacheWrite1hTokens: number;
  outputTokens: number;
};

/**
 * A turn's estimated cost in millionths of a dollar, rounded up to a whole one, so the estimate is
 * never low. The 5-minute writes are the cache writes less the 1-hour ones (SPEC-deploy, "Cost estimate").
 */
export function estimatedCost(tokens: TurnTokens): number {
  // In hundredths of a millionth of a dollar, every price is a whole number, so the sum is exact.
  const hundredths = (price: number) => Math.round(price * 100);
  const prices = pricesPerMillionTokens;
  const sum =
    tokens.inputTokens * hundredths(prices.uncachedInput) +
    tokens.cachedInputTokens * hundredths(prices.cacheReads) +
    (tokens.cacheWriteTokens - tokens.cacheWrite1hTokens) * hundredths(prices.cacheWrites5m) +
    tokens.cacheWrite1hTokens * hundredths(prices.cacheWrites1h) +
    tokens.outputTokens * hundredths(prices.output);
  return Math.ceil(sum / 100);
}
