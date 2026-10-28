// The names of the chat's three tools (SPEC-chat, Tools), in one leaf module. tools.ts names its tools
// with them, the read budget (limits.ts) counts the read tool by its name, and the wire middleware
// (wire.ts) sends each tool's result by its name. One name each, so no two modules can disagree on a
// tool's name, and the read budget cannot miss a read. This module imports nothing, so it is in no
// import cycle.

/** The read tool: it reads approved sources through readPassages(). */
export const READ_SOURCES = "read_sources";
/** The tool that opens the whole resume beside the chat. */
export const OPEN_RESUME = "open_resume";
/** The tool that opens a passage beside the chat: one that the conversation cites or that this turn read. */
export const OPEN_SOURCE = "open_source";

export type ToolName = typeof READ_SOURCES | typeof OPEN_RESUME | typeof OPEN_SOURCE;
