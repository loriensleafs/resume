// The QuestionLog contract suite (SPEC-chat, Question log, "The day window"; Testing Strategy,
// "The QuestionLog contract"). Seam 1 runs it against the in-memory log; SPEC-deploy runs it
// against its own store. Each store passes a factory, and the suite fixes today with the clock it
// gives that factory.

import { describe, expect, test } from "bun:test";
import type { QuestionLog, QuestionLogEntry } from "../question-log";

/** A clock that always reads `iso`. */
const clockAt = (iso: string) => () => new Date(iso);
/** 2026-10-27, the day the spec writes the window for. */
const noon = clockAt("2026-10-27T12:00:00.000Z");

const entryOn = (date: string): QuestionLogEntry => ({
  id: `entry-${date}`,
  date,
  question: "How did FedNow's bundle get under 1 MB?",
  read: ["fednow-bundle-size"],
  citations: ["fednow-bundle-size.2", "highlight:highspot.1"],
  removed: 1,
  outcome: "answered",
});

/**
 * Registers the contract's tests for one QuestionLog.
 *
 * @param name names the store in the test output, for example "in-memory" or "Upstash".
 * @param makeLog returns a new, empty log that reads "today" from `now`. The suite calls it once
 *   per test, so each test starts from an empty log.
 */
export function questionLogContract(
  name: string,
  makeLog: (now: () => Date) => QuestionLog | Promise<QuestionLog>,
): void {
  describe(`the QuestionLog contract: ${name}`, () => {
    test("an appended entry comes back from list(1)", async () => {
      const log = await makeLog(noon);
      const entry = entryOn("2026-10-27");

      await log.append(entry);

      expect(await log.list(1)).toEqual([entry]);
    });

    test("on 2026-10-27, list(1) returns the entry dated 2026-10-27 and none dated 2026-10-26", async () => {
      const log = await makeLog(noon);
      const today = entryOn("2026-10-27");

      await log.append(entryOn("2026-10-26"));
      await log.append(today);

      expect(await log.list(1)).toEqual([today]);
    });

    test.each([
      ["at its first moment", "2026-10-27T00:00:00.000Z"],
      ["at noon", "2026-10-27T12:00:00.000Z"],
      ["at its last moment", "2026-10-27T23:59:59.999Z"],
    ])(
      "on 2026-10-27 %s, list(7) returns the entries dated 2026-10-21 to 2026-10-27, newest first, and none dated 2026-10-20 or 2026-10-28",
      async (_, iso) => {
        const log = await makeLog(clockAt(iso));
        for (const date of [
          "2026-10-24",
          "2026-10-20",
          "2026-10-28",
          "2026-10-27",
          "2026-10-21",
          "2026-10-26",
          "2026-10-22",
          "2026-10-25",
          "2026-10-23",
        ]) {
          await log.append(entryOn(date));
        }

        const dates = (await log.list(7)).map((entry) => entry.date);

        expect(dates).toEqual([
          "2026-10-27",
          "2026-10-26",
          "2026-10-25",
          "2026-10-24",
          "2026-10-23",
          "2026-10-22",
          "2026-10-21",
        ]);
      },
    );

    test("an empty log returns no entries", async () => {
      const log = await makeLog(noon);

      expect(await log.list(7)).toEqual([]);
    });
  });
}
