export type Question = {
  text: string;
  correct: string;
  wrong: string[];
  explanation: string;
};

export type QuizInteraction = {
  ask: (message: string) => Promise<string>;
  show: (message: string) => void;
  random?: () => number;
};
