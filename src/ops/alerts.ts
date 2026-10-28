// The limit alerts (SPEC-deploy, "Limit alerts"; decision record rows 115 and 121): urgent ntfy pushes
// to Peter's phone, each a title and one line that names the next step. This file holds the alert
// rules, their texts and the push; the markers' keys and expiry rules are in upstash.ts. The kinds
// here are spend75, daycap, spendlimit and storefail. This file also prints the ops_error line of each
// failed store step, because a failed store call raises storefail. The storefail marker cannot live in
// a failing store, so it lives on the function instance only.
//
// An alert holds no visitor text: its words come only from its kind, its period and limits.ts.

import { utcDay } from "../chat/server/question-log";
import * as limits from "./limits";
import { ALERT_CLAIM_MS, alertPeriodEnd, claimAlertMarker, keepAlertMarker } from "./upstash";
import { UpstashError, safeBase, type UpstashStore } from "./upstash-rest";

/** The kinds of limit alert this file sends. Each is also the name in its marker's key. */
export type AlertKind = "spend75" | "daycap" | "spendlimit" | "storefail";

/**
 * One push: its kind, the period it covers (a UTC month "2026-10" or a UTC day "2026-10-27"), when
 * that period ends in Unix milliseconds, and its words. The end is worked out once, where the alert
 * is made, so no later step parses the period again.
 */
type Alert = { kind: AlertKind; period: string; endsAt: number; title: string; message: string };

/**
 * The steps of a turn that call the store: the budget's reservation and its take-back of a refused
 * turn's $0.90, the telemetry's record and the question log's append. Each is a word in the step's
 * ops_error line.
 */
export type StoreStep = "reserve" | "take_back" | "record" | "append";

/** The events that can raise a limit alert. Each resolves, also when the push or the store fails. */
export type LimitAlerts = {
  /** After a turn settles: the month's estimate with it, in millionths of a dollar, for the UTC month of `day`. */
  monthCost(day: string, monthCost: number): Promise<void>;
  /** After the daily cap refused a turn on the UTC day `day`. */
  dayCapped(day: string): Promise<void>;
  /** After a turn met Anthropic's monthly limit on the UTC day `day`. */
  spendLimited(day: string): Promise<void>;
  /**
   * After `step` failed (SPEC-deploy, "The store fails"): prints the step's ops_error line, with one
   * word for the error and nothing else. When a store call failed, it also pushes storefail, at most
   * once a UTC day from this function instance. Another failure, such as an entry whose date is not a
   * UTC day, is no store failure, so it pushes nothing.
   */
  storeFailed(step: StoreStep, error: unknown): Promise<void>;
};

/** What the alerts need from the function instance. */
export type AlertSettings = {
  /** NTFY_TOPIC_URL: the secret topic's address. With none, no alert is sent. */
  topicUrl: string | undefined;
  store: UpstashStore;
  fetch: typeof fetch;
  now: () => Date;
  /** The function log, for the ops_error line of a failed push or a failed store step. */
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
 * The limit alerts of one function instance. With no topic, every event sends nothing, and a failed
 * store step still prints its ops_error line; the missing variable shows in /api/status and in the
 * missing_config line of each turn (ops.ts; D22).
 */
export function limitAlerts(settings: AlertSettings): LimitAlerts {
  const send = settings.topicUrl ? sender(settings.topicUrl, settings) : undefined;
  return {
    async monthCost(day, monthCost) {
      // "Passes", as the daily cap's total passes $8: at exactly $15 nothing goes out.
      if (send && monthCost > spendAlertAt) await send.claimed(spend75(day.slice(0, 7)));
    },
    async dayCapped(day) {
      await send?.claimed(daycap(day));
    },
    async spendLimited(day) {
      await send?.claimed(spendlimit(day));
    },
    async storeFailed(step, error) {
      settings.print(opsError({ step, code: errorWord(error) }));
      await send?.storeFailed(error);
    },
  };
}

/** spend75: the month's estimate passed 75% of the limit. The text is SPEC-deploy's ("Limit alerts"). */
const spend75 = (month: string): Alert => ({
  kind: "spend75",
  period: month,
  endsAt: alertPeriodEnd(month),
  title: `Chat at ${percent(limits.spendAlertShare)} of its ${dollarText(limits.monthlyLimit)} limit for ${monthName(month)}`,
  message: "Raise it in the Anthropic Console, then in src/ops/limits.ts.",
});

/** daycap: the daily cap refused a turn. The text is a wording draft (docs/design/wording-drafts/D13.md). */
const daycap = (day: string): Alert => ({
  kind: "daycap",
  period: day,
  endsAt: alertPeriodEnd(day),
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
  endsAt: alertPeriodEnd(day),
  title: `Chat paused at Anthropic's monthly limit for ${monthName(day.slice(0, 7))}`,
  message: "Raise the limit in the Anthropic Console, then in src/ops/limits.ts. The chat tries again within an hour.",
});

/**
 * storefail: a store call failed, so the daily cap and the totals are blind while answers go on. The
 * text is a wording draft (docs/design/wording-drafts/D15.md).
 */
const storefail = (day: string): Alert => ({
  kind: "storefail",
  period: day,
  endsAt: alertPeriodEnd(day),
  title: `Chat store failed: answers go on without the ${dollarText(limits.dailyCap)} daily cap`,
  message: "Check the Upstash console for an outage or a spent budget.",
});

/**
 * The pushes of one function instance (SPEC-deploy, "Limit alerts"). A failed step prints an
 * ops_error line and never throws, so an alert never breaks an answer.
 *
 * - `claimed` sends spend75, daycap and spendlimit at most once in their period, across all function instances:
 *   it first claims the alert's marker in the store for 10 minutes, then pushes. After a successful
 *   push the marker lasts to the end of the period. After a failed push it expires in 10 minutes, and
 *   a later event claims it and pushes again.
 * - `storeFailed` sends storefail after a failed store call, at most once a UTC day from this
 *   instance. Its marker cannot live in the store that failed, so it lives here only, with the same
 *   rules: 10 minutes after a failed push, the end of the day after a successful one.
 *
 * The instance remembers until when each marker is known to live, and asks the store again only after
 * that. So an instance at the daily cap still refuses turns with no store call (SPEC-deploy, "The
 * daily cap"), and a flood of refusals cannot spend the store's budget on claims.
 */
function sender(topicUrl: string, { store, fetch, now, print }: AlertSettings) {
  /**
   * The topic's address, when a request to it keeps the topic's name, a secret, off the network in
   * clear text: https, or loopback for the in-test server, as for the store's token (upstash-rest.ts).
   */
  const topic = safeBase(topicUrl);
  /** By marker: the time, in Unix milliseconds, before which the marker is known to live. */
  const quietUntil = new Map<string, number>();
  const markerOf = (alert: Alert) => `${alert.kind}:${alert.period}`;

  /**
   * Starts an alert on this instance. Gives the time and the topic, or undefined when nothing goes
   * out: the marker is known to live, or the topic's address is not safe.
   */
  const start = (alert: Alert): { at: number; topic: string } | undefined => {
    const at = now().getTime();
    if (at < (quietUntil.get(markerOf(alert)) ?? 0)) return undefined;
    // Set before any await, so another event on this instance meanwhile asks the store nothing.
    // 10 minutes is how long a claim holds the store's marker. It also stands after a failed push,
    // whose marker expires then, and after a failed store call, which a later event tries again.
    quietUntil.set(markerOf(alert), at + ALERT_CLAIM_MS);
    // No push can go out, so no marker is claimed; the line comes again at most every 10 minutes.
    if (topic === undefined) {
      print(opsError({ step: "alert_push", alert: alert.kind, code: "NOT_HTTPS" }));
      return undefined;
    }
    return { at, topic };
  };

  /** Pushes the alert. After a success, the instance stays quiet on it to the end of its period. Gives whether ntfy took it. */
  const deliver = async (to: string, alert: Alert): Promise<boolean> => {
    const failure = await push(to, fetch, alert);
    if (failure !== undefined) {
      print(opsError({ step: "alert_push", alert: alert.kind, code: failure }));
      return false;
    }
    quietUntil.set(markerOf(alert), alert.endsAt);
    return true;
  };

  /** Pushes storefail after a failed store call. Any other error is no store failure, so it pushes nothing. */
  const storeFailed = async (error: unknown) => {
    if (!(error instanceof UpstashError)) return;
    const alert = storefail(utcDay(now().getTime()));
    const started = start(alert);
    if (started !== undefined) await deliver(started.topic, alert);
  };

  /** Runs one store step of an alert; a failure prints its ops_error line, raises storefail and gives undefined. */
  const storeStep = async <T>(step: string, alert: Alert, call: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await call();
    } catch (error) {
      print(opsError({ step, alert: alert.kind, code: errorWord(error) }));
      await storeFailed(error);
      return undefined;
    }
  };

  /** Sends an alert whose marker lives in the store. */
  const claimed = async (alert: Alert) => {
    const started = start(alert);
    if (started === undefined) return;
    const claim = await storeStep("alert_claim", alert, () => claimAlertMarker(store, alert.kind, alert.period, new Date(started.at)));
    if (claim === undefined) return;
    if (!claim.claimed) {
      quietUntil.set(markerOf(alert), started.at + claim.heldForMs);
      return;
    }
    if (!(await deliver(started.topic, alert))) return;
    await storeStep("alert_keep", alert, () => keepAlertMarker(store, alert.kind, alert.period, alert.endsAt));
  };

  return { claimed, storeFailed };
}

/**
 * How long a push may take, in milliseconds (SPEC-deploy, "Store calls": each push, 3 s). The daycap
 * push runs inside reserve(), the spend75 push inside record(), and the storefail push inside the step
 * whose store call failed, so a hung ntfy server holds a visitor's answer no longer than this.
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

/**
 * The ops_error line of a failed step: the step, the alert's kind for an alert's step, and one short
 * word for the failure, and nothing else.
 */
const opsError = (fields: { step: string; alert?: AlertKind; code: string }) => JSON.stringify({ event: "ops_error", ...fields });

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
