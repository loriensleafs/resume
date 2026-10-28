// The knowledge base's types (SPEC-knowledge, Code Style), for the renderers, the reads, the site
// and the chat. This module holds types only: importing it reads no file and bundles no code.

import type { Source } from "./parse";

export type { Passage, Source, Subject } from "./parse";

/** One entry of the core: the chat sees it as `[<id>] <title>: <text>`. */
export type Entry = { id: string; kind: "resume" | "logistics" | "catalog"; title: string; text: string };
/** Server only: it holds each source's Not public text. The chat's function gets it through virtual:knowledge. */
export type Knowledge = { core: Entry[]; sources: Source[] };
/** Everything that reaches a browser: the site's pages and the device index. It holds no Not public text. */
export type PublicKnowledge = { core: Entry[]; sources: Omit<Source, "notPublic">[] };
