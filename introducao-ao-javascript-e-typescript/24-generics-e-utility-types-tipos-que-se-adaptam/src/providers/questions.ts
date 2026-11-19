import type { Question } from '../types.ts';
import {
  DOWNLOAD_TIMEOUT_MS,
  QUESTIONS_PER_RUN,
  QUESTIONS_URL,
} from '../config.ts';
import { selectQuestions } from '../questions.ts';

export const loadQuestions = async (
  limit = QUESTIONS_PER_RUN,
  fetchFn: typeof fetch = fetch
): Promise<Question[]> => {
  const response = await fetchFn(QUESTIONS_URL, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Could not load questions from the Gist (HTTP ${response.status}).`
    );
  }

  const questions: unknown = await response.json();

  return selectQuestions(questions, limit);
};
