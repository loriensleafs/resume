// The request's shapes (SPEC-chat, The request): the messages schema, which handleChat() checks after
// chatParamsFromRequestBody(), and ChatProps, the three properties the browser sends in forwardedProps.

import { z } from "zod";

/**
 * One text part of a user message, in the wire's shape. The browser sends a question of text parts as
 * one string (uiMessagesToWire), and text parts only beside another part, such as an image.
 */
const TextPart = z.strictObject({ type: z.literal("text"), text: z.string() });

/**
 * The messages of a request (step 4). Only the roles user, assistant and tool pass, and a user message
 * holds text only: a string, or text parts. Any other role (system, developer, reasoning, activity) or
 * part (an image, a document) fails. chatParamsFromRequestBody() has checked the types of the other
 * fields, so they pass here as they are.
 */
export const ChatMessages = z.array(
  z.discriminatedUnion("role", [
    z.looseObject({ role: z.literal("user"), content: z.union([z.string(), z.array(TextPart)]) }),
    z.looseObject({ role: z.literal("assistant") }),
    z.looseObject({ role: z.literal("tool") }),
  ]),
);

export type ChatMessage = z.infer<typeof ChatMessages>[number];

/**
 * The question's own request properties, which the browser sends in forwardedProps through
 * sendMessage's body (step 5). Strict: no other key passes, so a request cannot choose the model or
 * anything else that chat() takes.
 */
export const ChatProps = z.strictObject({
  scope: z.strictObject({ roleId: z.string().max(60) }).nullish(),
  audience: z.enum(["recruiter", "manager", "engineer", "designer", "product"]).nullish(),
  about: z.string().max(120).regex(/^[a-z0-9:.-]+$/).nullish(), // a resume entry id or passage id from "Ask about this"
});

export type ChatProps = z.infer<typeof ChatProps>;
