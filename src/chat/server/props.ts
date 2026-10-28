// The request's shapes (SPEC-chat, The request): the messages schema, which handleChat() checks after
// chatParamsFromRequestBody(), and ChatProps, the three properties the browser sends in forwardedProps.

import { z } from "zod";

/**
 * One text part of a user message, in the wire's shape. The browser sends a question of text parts as
 * one string (uiMessagesToWire), and text parts only beside another part, such as an image.
 */
const TextPart = z.strictObject({ type: z.literal("text"), text: z.string() });

/** A user message, which holds text only: a string, or text parts. */
export const UserMessage = z.looseObject({ role: z.literal("user"), content: z.union([z.string(), z.array(TextPart)]) });

/**
 * A user message's text as sent: the question's, and an earlier question's in the conversation sent
 * (history.ts). Its text parts join with no separator, as chat() joins them for the model.
 */
export function questionText(message: z.infer<typeof UserMessage>): string {
  return typeof message.content === "string" ? message.content : message.content.map((part) => part.text).join("");
}

/**
 * The messages of a request (step 4), and the question they end with. Only the roles user, assistant and
 * tool pass, and a user message holds text only. Any other role (system, developer, reasoning, activity)
 * or part (an image, a document) fails. The newest message is the question: a user message with at least
 * one character that is not white space, because a request with no question is not a turn.
 * chatParamsFromRequestBody() has checked the types of the other fields, so they pass here as they are.
 */
export const ChatMessages = z
  .array(
    z.discriminatedUnion("role", [
      UserMessage,
      z.looseObject({ role: z.literal("assistant") }),
      z.looseObject({ role: z.literal("tool") }),
    ]),
  )
  .transform((messages, ctx) => {
    const newest = messages.at(-1);
    const question = newest?.role === "user" ? questionText(newest) : undefined;
    if (question?.trim()) return { question };
    ctx.addIssue("The newest message is not a question with text.");
    return z.NEVER;
  });

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
