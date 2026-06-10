import type { Keyword, Option, Question } from "@/lib/types";
import { shuffle, uid } from "@/lib/utils";

export function renderQuestionParts(text: string, keywords: Keyword[], visible: boolean) {
  if (!visible || !keywords.length) return [{ text, marked: false }];
  const ranges = keywords
    .filter((keyword) => typeof keyword.startIndex === "number" && typeof keyword.endIndex === "number")
    .map((keyword) => ({ start: keyword.startIndex ?? 0, end: keyword.endIndex ?? 0 }))
    .filter((range) => range.end > range.start && range.start >= 0 && range.end <= text.length)
    .sort((a, b) => a.start - b.start);
  const parts: { text: string; marked: boolean }[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    if (range.start > cursor) parts.push({ text: text.slice(cursor, range.start), marked: false });
    parts.push({ text: text.slice(range.start, range.end), marked: true });
    cursor = range.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), marked: false });
  return parts.length ? parts : [{ text, marked: false }];
}

export function addKeyword(question: Question, start: number, end: number): Question {
  const cleanStart = Math.max(0, Math.min(start, end));
  const cleanEnd = Math.min(question.questionText.length, Math.max(start, end));
  if (cleanEnd <= cleanStart) return question;
  const text = question.questionText.slice(cleanStart, cleanEnd);
  return {
    ...question,
    keywords: [...question.keywords, { id: uid("keyword"), text, startIndex: cleanStart, endIndex: cleanEnd }]
  };
}

export function prepareExamQuestions(questions: Question[], count: number, randomQuestions: boolean, randomOptions: boolean) {
  const selected = (randomQuestions ? shuffle(questions) : [...questions]).slice(0, count);
  return selected.map((question) => {
    if (!randomOptions) return question;
    const options = shuffle(question.options);
    return { ...question, options };
  });
}

export function emptyOption(label: Option["label"]): Option {
  return { id: uid("option"), label, text: "" };
}

export function getCorrectOptionIds(question: Question) {
  const ids = question.correctOptionIds?.length ? question.correctOptionIds : [question.correctOptionId];
  return Array.from(new Set(ids.filter(Boolean)));
}

export function isMultiAnswer(question: Question) {
  return getCorrectOptionIds(question).length > 1;
}

export function isCorrectSelection(question: Question, selectedIds: string[]) {
  const correct = getCorrectOptionIds(question).slice().sort();
  const selected = Array.from(new Set(selectedIds)).sort();
  return correct.length === selected.length && correct.every((id, index) => id === selected[index]);
}
