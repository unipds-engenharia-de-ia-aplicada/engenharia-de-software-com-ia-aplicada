import type { Question } from '../types';
import {
  DOWNLOAD_TIMEOUT_MS,
  QUESTIONS_PER_RUN,
  QUESTIONS_URL,
} from '../config';
import { selectQuestions } from '../questions';

export const loadQuestions = async (
  limit = QUESTIONS_PER_RUN
): Promise<Question[]> => {
  const response = await fetch(QUESTIONS_URL, {
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
