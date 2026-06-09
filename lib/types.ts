export type OptionLabel = "A" | "B" | "C" | "D";

export type QuizSet = {
  id: string;
  title: string;
  questions: Question[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  createdByEmail?: string;
};

export type Question = {
  id: string;
  questionText: string;
  keywords: Keyword[];
  options: Option[];
  correctOptionId: string;
  explanation?: string;
};

export type Keyword = {
  id: string;
  text: string;
  startIndex?: number;
  endIndex?: number;
};

export type Option = {
  id: string;
  label: OptionLabel;
  text: string;
};

export type QuestionProgress = {
  learned: boolean;
  starred: boolean;
  wrongCount: number;
  correctStreak: number;
};

export type ProgressMap = Record<string, QuestionProgress>;

export type ParseResult = {
  questions: Question[];
  errors: string[];
};
