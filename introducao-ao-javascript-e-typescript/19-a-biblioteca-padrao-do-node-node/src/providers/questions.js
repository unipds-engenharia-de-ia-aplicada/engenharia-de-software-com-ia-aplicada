import {
  DOWNLOAD_TIMEOUT_MS,
  QUESTIONS_PER_RUN,
  QUESTIONS_URL,
} from '../config.js';
import { selectQuestions } from '../questions.js';

export const loadQuestions = async (limit = QUESTIONS_PER_RUN) => {
  const response = await fetch(QUESTIONS_URL, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Could not load questions from the Gist (HTTP ${response.status}).`
    );
  }

  return selectQuestions(await response.json(), limit);
};
