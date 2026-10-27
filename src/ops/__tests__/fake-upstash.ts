// The in-test Upstash REST server for seam 2 (SPEC-deploy, Testing Strategy). It records every
// request, so a test can check what reached the store, or that nothing did. It runs no command
// yet: it answers every request with Upstash's error shape, `{ error }` with status 400.

export type UpstashRequest = {
  method: string;
  path: string;
  authorization: string | null;
  body: string;
};

export type FakeUpstash = {
  /** The server's origin, for KV_REST_API_URL. */
  url: string;
  /** Every request the server received, in the order received. */
  requests: UpstashRequest[];
  stop(): Promise<void>;
};

/** Starts the server on a free port of 127.0.0.1. Stop it when the test ends. */
export function startFakeUpstash(): FakeUpstash {
  const requests: UpstashRequest[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      requests.push({
        method: request.method,
        path: new URL(request.url).pathname,
        authorization: request.headers.get("authorization"),
        body: await request.text(),
      });
      return Response.json({ error: "ERR unknown command" }, { status: 400 });
    },
  });
  return { url: server.url.origin, requests, stop: () => server.stop(true) };
}
