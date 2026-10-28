// The limit alerts (SPEC-deploy, "Limit alerts"; decision record rows 115 and 121): urgent ntfy pushes
// to Peter's phone, each a title and one line that names the next step. This file holds the alert
// rules, their texts and the push; the markers' keys and expiry rules are in upstash.ts. The kinds
// here are spend75, daycap and spendlimit. The store's storefail (D15) joins them as one more kind
// and text, and, because its marker cannot live in a failing store, as a sender of its own beside
// push().
//
// An alert holds no visitor text: its words come only from its kind, its period and limits.ts.

import * as limits from "./limits";
import { ALERT_CLAIM_MS, alertPeriodEnd, claimAlertMarker, keepAlertMarker } from "./upstash";
import { safeBase, type UpstashStore } from "./upstash-rest";

/** The kinds of limit alert this file sends. Each is also the name in its marker's key. */
export type AlertKind = "spend75" | "daycap" | "spendlimit";

/** One push: its kind, the period it covers (a UTC month "2026-10" or a UTC day "2026-10-27"), and its words. */
type Alert = { kind: AlertKind; period: string; title: string; message: string };

/** The events that can raise a limit alert. Each resolves, also when the push or the store fails. */
export type LimitAlerts = {
  /** After a turn settles: the month's estimate with it, in millionths of a dollar, for the UTC month of `day`. */
  monthCost(day: string, monthCost: number): Promise<void>;
  /** After the daily cap refused a turn on the UTC day `day`. */
  dayCapped(day: string): Promise<void>;
  /** After a turn met Anthropic's monthly limit on the UTC day `day`. */
  spendLimited(day: string): Promise<void>;
};

/** What the alerts need from the function instance. */
export type AlertSettings = {
  /** NTFY_TOPIC_URL: the secret topic's address. With none, no alert is sent. */
  topicUrl: string | undefined;
  store: UpstashStore;
  fetch: typeof fetch;
  now: () => Date;
  /** The function log, for the ops_error line of a failed push. */
  print: (line: string) => void;
};

/**
 * The month's estimate, in millionths of a dollar, past which spend75 goes out: 75% of the monthly
 * limit, $15 of $20. The estimate counts a kept reservation as settled cost: a turn whose last model
 * call did not finish adds its whole $0.90 to the month (daily-totals.ts, "Which usage a turn settles
 * with"). So the estimate errs high by design, and spend75 comes early, never late.
 */
const spendAlertAt = Math.round(limits.monthlyLimit * limits.spendAlertShare);

/**
 * The limit alerts of one function instance. With no topic, every event resolves at once and sends
 * nothing; the missing variable shows in /api/status and in its ops_error line (D15, D22).
 */
export function limitAlerts(settings: AlertSettings): LimitAlerts {
  if (!settings.topicUrl) return { monthCost: async () => {}, dayCapped: async () => {}, spendLimited: async () => {} };
  const send = sender(settings.topicUrl, settings);
  return {
    async monthCost(day, monthCost) {
      // "Passes", as the daily cap's total passes $8: at exactly $15 nothing goes out.
      if (monthCost > spendAlertAt) await send(spend75(day.slice(0, 7)));
    },
    dayCapped: (day) => send(daycap(day)),
    spendLimited: (day) => send(spendlimit(day)),
  };
}

/** spend75: the month's estimate passed 75% of the limit. The text is SPEC-deploy's ("Limit alerts"). */
const spend75 = (month: string): Alert => ({
  kind: "spend75",
  period: month,
  title: `Chat at ${percent(limits.spendAlertShare)} of its ${dollarText(limits.monthlyLimit)} limit for ${monthName(month)}`,
  message: "Raise it in the Anthropic Console, then in src/ops/limits.ts.",
});

/** daycap: the daily cap refused a turn. The text is a wording draft (docs/design/wording-drafts/D13.md). */
const daycap = (day: string): Alert => ({
  kind: "daycap",
  period: day,
  title: `Chat paused at its ${dollarText(limits.dailyCap)} daily cap until 00:00 UTC`,
  message: "If bun run questions shows real spend, raise the cap in src/ops/limits.ts.",
});

/**
 * spendlimit: a turn met Anthropic's monthly limit, once a UTC day. The text is a wording draft
 * (docs/design/wording-drafts/D14.md). It names no amount: the limit is the one set in the Console,
 * which limits.ts only copies.
 */
const spendlimit = (day: string): Alert => ({
  kind: "spendlimit",
  period: day,
  title: `Chat paused at Anthropic's monthly limit for ${monthName(day.slice(0, 7))}`,
  message: "Raise the limit in the Anthropic Console, then in src/ops/limits.ts. The chat tries again within an hour.",
});

/**
 * Sends each alert at most once in its period, across all function instances (SPEC-deploy, "Limit
 * alerts"): it first claims the alert's marker in the store for 10 minutes, then pushes. After a
 * successful push the marker lasts to the end of the period. After a failed push it expires in 10
 * minutes, and a later event claims it and pushes again. A failed step prints an ops_error line and
 * never throws, so an alert never breaks an answer.
 *
 * The function instance remembers until when each marker is known to live, and asks the store again
 * only after that. So an instance at the daily cap still refuses turns with no store call (SPEC-deploy,
 * "The daily cap"), and a flood of refusals cannot spend the store's budget on claims.
 */
function sender(topicUrl: string, { store, fetch, now, print }: AlertSettings): (alert: Alert) => Promise<void> {
  /**
   * The topic's address, when a request to it keeps the topic's name, a secret, off the network in
   * clear text: https, or loopback for the in-test server, as for the store's token (upstash-rest.ts).
   */
  const topic = safeBase(topicUrl);
  /** By marker: the time, in Unix milliseconds, before which the marker is known to live. */
  const quietUntil = new Map<string, number>();
  /** Runs one step that calls the store; a failure prints its ops_error line and gives undefined. */
  const storeStep = async <T>(step: string, alert: Alert, call: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await call();
    } catch (error) {
      print(opsError(step, alert.kind, errorWord(error)));
      return undefined;
    }
  };
  return async (alert) => {
    const marker = `${alert.kind}:${alert.period}`;
    const at = now().getTime();
    if (at < (quietUntil.get(marker) ?? 0)) return;
    // Set before the claim's await, so another event on this instance meanwhile asks the store
    // nothing. 10 minutes is how long this claim holds the marker. It also stands after a failed
    // push, whose marker expires then, and after a failed store call, which a later event tries again.
    quietUntil.set(marker, at + ALERT_CLAIM_MS);
    // No push can go out, so no marker is claimed; the line comes again at most every 10 minutes.
    if (topic === undefined) {
      print(opsError("alert_push", alert.kind, "NOT_HTTPS"));
      return;
    }
    const claim = await storeStep("alert_claim", alert, () => claimAlertMarker(store, alert.kind, alert.period, new Date(at)));
    if (claim === undefined) return;
    if (!claim.claimed) {
      quietUntil.set(marker, at + claim.heldForMs);
      return;
    }
    const failure = await push(topic, fetch, alert);
    if (failure !== undefined) {
      print(opsError("alert_push", alert.kind, failure));
      return;
    }
    quietUntil.set(marker, alertPeriodEnd(alert.period));
    await storeStep("alert_keep", alert, () => keepAlertMarker(store, alert.kind, alert.period));
  };
}

/**
 * How long a push may take, in milliseconds (SPEC-deploy, "Store calls": each push, 3 s). The daycap
 * push runs inside reserve() and the spend75 push inside record(), so a hung ntfy server holds a
 * visitor's answer no longer than this.
 */
const PUSH_LIMIT_MS = 3_000;

/**
 * Pushes one alert to the topic with priority urgent (ntfy, "Message priority": urgent is 5, the
 * highest). Gives undefined when ntfy took it, or one short word for the failure: the HTTP status, or
 * a thrown error's code or name. Never the error's message, which can hold the topic's address. A
 * push that passes its time limit fails with the name TimeoutError.
 */
async function push(topicUrl: string, fetchFn: typeof fetch, alert: Alert): Promise<string | undefined> {
  try {
    const response = await fetchFn(topicUrl, {
      method: "POST",
      headers: { title: alert.title, priority: "urgent", "content-type": "text/plain; charset=utf-8" },
      body: alert.message,
      // ntfy answers a publish itself; a redirect would send the alert to another address.
      redirect: "error",
      signal: AbortSignal.timeout(PUSH_LIMIT_MS),
    });
    await response.body?.cancel();
    return response.ok ? undefined : `HTTP_${response.status}`;
  } catch (error) {
    // Bun's connection error holds the whole address in its message and its `path`, the topic included.
    return errorWord(error);
  }
}

/** The ops_error line of a failed alert step: the step, the alert's kind and one short word, and nothing else. */
const opsError = (step: string, alert: AlertKind, code: string) => JSON.stringify({ event: "ops_error", step, alert, code });

/** A word that cannot carry text: a code or a name. */
const WORD = /^[A-Za-z0-9_]{1,32}$/;

/** A thrown error as one short word: its code when it has one, else its name. */
function errorWord(error: unknown): string {
  const code: unknown = error instanceof Error ? Reflect.get(error, "code") : undefined;
  if (typeof code === "string" && WORD.test(code)) return code;
  return error instanceof Error && WORD.test(error.name) ? error.name : "ERROR";
}

/** A share as a whole percent: 0.75 is "75%". */
const percent = (share: number) => `${Math.round(share * 100)}%`;

/** A sum in millionths of a dollar as the push writes it: "$20", or "$20.50" when it has cents. */
const dollarText = (amount: number) => `$${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 2)}`;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The English name of a UTC month "2026-10": "October". */
const monthName = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
