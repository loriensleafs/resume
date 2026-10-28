// The names of the chat's three tools (SPEC-chat, Tools), in one leaf module. tools.ts names its tools
// with them, the read budget (limits.ts) counts the read tool by its name, and the wire middleware
// (wire.ts) sends each tool's result by its name. One name each, so no two modules can disagree on a
// tool's name, and the read budget cannot miss a read. isToolName() is the one check of a name that
// the model or a visitor wrote, for wire.ts and the conversation sent (conversation-sent.ts). This
// module imports nothing, so it is in no import cycle.

/** The read tool: it reads approved sources through readPassages(). */
export const READ_SOURCES = "read_sources";
/** The tool that opens the whole resume beside the chat. */
export const OPEN_RESUME = "open_resume";
/** The tool that opens a passage beside the chat: one that the conversation cites or that this turn read. */
export const OPEN_SOURCE = "open_source";

/** The three names, the one list that ToolName and isToolName() read. */
const TOOL_NAMES = [READ_SOURCES, OPEN_RESUME, OPEN_SOURCE] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

/** Whether a name is one of the chat's tools, so a table keyed by ToolName can be read with it. */
export const isToolName = (name: string): name is ToolName => TOOL_NAMES.some((tool) => tool === name);
