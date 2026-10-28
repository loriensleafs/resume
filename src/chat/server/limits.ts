// The chat's limits (SPEC-chat, Limits): code enforces every limit below except the fit check's; the
// system prompt only explains them to the model. Peter set answerTokens, deadlineMs and the effort
// (decision record rows 131 and 132); the other values were approved with the spec. A change to a
// limit asks Peter first (SPEC-chat, Boundaries).
//
// C6 adds the readBudget middleware here, and C13 the deadline.

export const turnLimits = {
  questionCharacters: 10_000, // fits a pasted job description
  historyCharacters: 40_000,  // earlier turns sent, oldest dropped first (row 125)
  requestBytes: 262_144,      // a larger request gets 413 REQUEST_TOO_LARGE (row 125)
  reads: 3,                   // read_sources calls per turn, the "Ask about this" read included (Peter, 2026-10-27)
  modelCalls: 6,              // agentLoopStrategy: maxIterations(6); the sixth call can only answer
  answerTokens: 8_000,        // Anthropic max_tokens for each model call, thinking included (row 131)
  turnsSent: 20,              // earlier turns stay on screen but are not sent
  deadlineMs: 120_000,        // the handler ends the run with RUN_ERROR DEADLINE after this (row 132)
  followUps: 2,
  followUpCharacters: 80,
  topicCharacters: 60,        // the read tool's "topic" text in the answer steps
  thinkingCharacters: 20_000, // the thinking summary of one turn that reaches the browser; longer text ends with "…"
                              // (a typical one is 1 to 3 KB; the conductor's value, for Peter's end review)
  fitCheckRequirements: 10,   // a prompt rule: the fit check lists at most this many requirements; the evals check it
} as const;
