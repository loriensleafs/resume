// The in-test ntfy server for seam 2 (SPEC-deploy, Testing Strategy). It takes a publish as ntfy.sh
// does (https://docs.ntfy.sh/publish/, read 2026-10-27): a POST or PUT to /<topic>, the message as the
// body, the title in `X-Title` or its aliases `Title`, `ti` and `t`, and the priority in `X-Priority`
// or its aliases `Priority`, `prio` and `p`, as a number from 1 to 5 or by name (`urgent` and `max`
// are 5). It records each push it accepts, and a test can make it refuse the next ones, as ntfy.sh
// refuses with 429 past its daily limit of messages from one address, or hold them with no answer, as
// a hung server does.

/** One push that the server accepted, as ntfy reads it. */
export type Push = {
  topic: string;
  title: string | null;
  priority: number;
  message: string;
  /** Every request header, its name in lower case, so a test can check that no header holds visitor text. */
  headers: Record<string, string>;
};

export type FakeNtfy = {
  /** The server's origin. A topic's address is `${url}/<topic>`. */
  url: string;
  /** Every push the server accepted, in the order received. */
  pushes: Push[];
  /** How many publishes the server refused. */
  refused(): number;
  /** Refuses the next `count` publishes with `status`, 429 by default, as ntfy.sh does past its daily limit. */
  refuseNext(count: number, status?: number): void;
  /** How many publishes the server held. */
  held(): number;
  /** Holds the next `count` publishes with no answer, as a hung server does, until the server stops. */
  holdNext(count: number): void;
  stop(): Promise<void>;
};

/** ntfy's priorities by name; a number from 1 to 5 is taken as it is. */
const PRIORITIES: Record<string, number> = { min: 1, low: 2, default: 3, high: 4, max: 5, urgent: 5 };

/** A topic name: letters, numbers, underscores and dashes, at most 64 characters (ntfy, "Picking a topic"). */
const TOPIC = /^[-_A-Za-z0-9]{1,64}$/;

/** Starts the server on a free port of 127.0.0.1. Stop it when the test ends. */
export function startFakeNtfy(): FakeNtfy {
  const pushes: Push[] = [];
  let refusals: { count: number; status: number } = { count: 0, status: 429 };
  let refused = 0;
  let holds = 0;
  /** The answers of the held publishes, which stop() gives at last, so no handler is left waiting. */
  const heldAnswers: (() => void)[] = [];

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const topic = new URL(request.url).pathname.slice(1);
      const message = await request.text();
      if ((request.method !== "POST" && request.method !== "PUT") || !TOPIC.test(topic)) {
        return Response.json({ code: 40401, http: 404, error: "page not found" }, { status: 404 });
      }
      if (holds > 0) {
        holds--;
        await new Promise<void>((answer) => heldAnswers.push(answer));
        return Response.json({ code: 50301, http: 503, error: "held until the server stopped" }, { status: 503 });
      }
      if (refusals.count > 0) {
        refusals.count--;
        refused++;
        return Response.json({ code: 42901, http: refusals.status, error: "limit reached" }, { status: refusals.status });
      }
      const header = (...names: string[]) => names.map((name) => request.headers.get(name)).find((value) => value !== null) ?? null;
      const named = header("x-priority", "priority", "prio", "p");
      const priority = named === null ? 3 : (PRIORITIES[named.toLowerCase()] ?? (/^[1-5]$/.test(named) ? Number(named) : undefined));
      if (priority === undefined) return Response.json({ code: 40007, http: 400, error: "invalid priority" }, { status: 400 });
      const title = header("x-title", "title", "ti", "t");
      pushes.push({ topic, title, priority, message, headers: Object.fromEntries(request.headers) });
      return Response.json({ id: crypto.randomUUID(), time: Math.floor(Date.now() / 1000), event: "message", topic, title, message, priority });
    },
  });

  return {
    url: server.url.origin,
    pushes,
    refused: () => refused,
    refuseNext(count, status = 429) {
      refusals = { count, status };
    },
    held: () => heldAnswers.length,
    holdNext(count) {
      holds = count;
    },
    stop() {
      for (const answer of heldAnswers) answer();
      return server.stop(true);
    },
  };
}
