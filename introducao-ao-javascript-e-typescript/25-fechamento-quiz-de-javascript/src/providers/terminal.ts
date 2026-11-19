import type { QuizInteraction } from '../types.ts';
import { createInterface } from 'node:readline/promises';
import { ANSWER_PROMPT } from '../config.ts';

export const showMessage = (message: string): void => console.log(message);

export const createTerminal = (): QuizInteraction & { close: () => void } => {
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const controller = new AbortController();

  terminal.once('SIGINT', () => controller.abort());

  return {
    ask: (message) => {
      showMessage(message);

      return terminal.question(ANSWER_PROMPT, { signal: controller.signal });
    },
    show: showMessage,
    close: () => terminal.close(),
  };
};
