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
