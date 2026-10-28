// The scripted model turns (SPEC-chat, Project Structure): each one a question and the fake model's answer for each
// model call of its turn. Outside production the route answers with them (SPEC-chat, Tech Stack; "The route file"), so
// `bun run dev`, `bun run preview` and the browser test get scripted answers, and the seam-1 tests ask them too.
// This is a site file: the preview's fake model bundles it with the chat function (SPEC-deploy), so it holds no private
// detail. Each id it reads or cites is one the repository's knowledge has; handle-chat.test.ts ("the scripted turns")
// asks every turn with that knowledge. The answer texts keep the approved sources' own words (decision 0001).

import type { ModelMessage } from "@tanstack/ai";
import { fakeText, type FakeResponse } from "@tanstack/ai/testing";

/** One scripted turn: the question it answers, and the fake model's answer for each model call of the turn, in order. */
export type ScriptedTurn = { question: string; responses: [FakeResponse, ...FakeResponse[]] };

export const SCRIPTED_TURNS: readonly ScriptedTurn[] = [
  {
    // SPEC-chat's example of the read loop (One turn): the catalog's summary of fednow-bundle-size selects it.
    question: "How did FedNow's bundle get under 1 MB?",
    responses: [
      { toolCalls: [{ name: "read_sources", input: { ids: ["fednow-bundle-size"], topic: "FedNow's initial bundle" } }] },
      {
        thinking:
          "The source on FedNow's bundle answers this. Its passage on what Peter did and its passage on how it worked " +
          "give the answer, and the second FedNow highlight gives the result.",
        text:
          "Peter did the initial audit of the application and found what made the bundles so large " +
          "[fednow-bundle-size.2]. The bundle came down through code splitting and lazy loading, micro-frontends, a " +
          "new build setup, fewer heavy dependencies, and the design system and shared packages rebuilt as " +
          "tree-shakeable ES modules instead of CommonJS [fednow-bundle-size.3]. The initial bundle went from over " +
          "15 MB to under 1 MB across multiple applications, without delaying FedNow's launch [highlight:fednow.2]. " +
          "<<follow-up: What else did Peter lead at FedNow?>> <<follow-up: Is Peter open to remote work?>>",
      },
    ],
  },
  {
    // User story 1: a recruiter's short question, answered from the core's logistics answer with no read.
    question: "Is Peter open to remote work?",
    responses: [
      { text: "Yes. Peter is open to remote, hybrid or on-site roles in the Seattle area [logistics:work-arrangement]." },
    ],
  },
];

/** The text of the preview's own answer, to a question that no scripted turn has. */
export const PREVIEW_ANSWER =
  "This is the preview's scripted model, and it answers only its scripted questions. Try one of these.";

/** The preview's own turn: its answer, with the first two scripted questions as its follow-up questions. */
const PREVIEW_TURN: Pick<ScriptedTurn, "responses"> = {
  responses: [
    {
      text: [PREVIEW_ANSWER, ...SCRIPTED_TURNS.slice(0, 2).map((turn) => `<<follow-up: ${turn.question}>>`)].join(" "),
    },
  ],
};

/** A question as the pick compares it: no white space at its ends, one space for each run of it, in lower case. */
const comparable = (question: string) => question.trim().replace(/\s+/g, " ").toLowerCase();

const TURNS_BY_QUESTION = new Map(SCRIPTED_TURNS.map((turn) => [comparable(turn.question), turn]));
// Two turns for one question would leave one of them unreachable.
if (TURNS_BY_QUESTION.size !== SCRIPTED_TURNS.length) {
  throw new Error("fixtures.ts: two scripted turns have the same question");
}

/** The scripted turn of a question; the preview's own turn when no scripted turn has the question. */
export function scriptedTurnFor(question: string): Pick<ScriptedTurn, "responses"> {
  return TURNS_BY_QUESTION.get(comparable(question)) ?? PREVIEW_TURN;
}

/** The turn's question: the newest user message's text. The About read's messages come after it (about-read.ts). */
function questionOf(messages: readonly ModelMessage[]): string {
  const content = messages.findLast((message) => message.role === "user")?.content ?? "";
  if (typeof content === "string") return content;
  return content.map((part) => (part.type === "text" ? part.content : "")).join("");
}

/**
 * The preview's fake model, new for each request, so two requests never share its queue of answers. Its first model
 * call picks the scripted turn by the question, answers with the turn's first answer, and queues the rest for the
 * turn's later model calls. A model call after the turn's last answer gets the fake's own RUN_ERROR.
 */
export function scriptedModel() {
  const fake = fakeText();
  fake.setResponses([
    ({ request }) => {
      const [first, ...later] = scriptedTurnFor(questionOf(request.messages)).responses;
      fake.appendResponses(later);
      return first;
    },
  ]);
  return fake;
}
