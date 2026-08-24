import { AsyncLocalStorage } from "node:async_hooks";

interface ChatUserStore {
  userId: string;
}

const chatUserContext = new AsyncLocalStorage<ChatUserStore>();

/** Run `fn` with the current chat `userId` bound (for tools / learning). */
export function runWithChatUser<T>(userId: string, fn: () => T): T {
  return chatUserContext.run({ userId }, fn);
}

/** Active chat userId from AsyncLocalStorage, if any. */
export function getChatUserId(): string | undefined {
  return chatUserContext.getStore()?.userId;
}
