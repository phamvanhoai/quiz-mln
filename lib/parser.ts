import type { Option, OptionLabel, ParseResult, Question } from "@/lib/types";
import { uid } from "@/lib/utils";

const optionLabels: OptionLabel[] = ["A", "B", "C", "D", "E", "F"];
const optionLine = /^([A-F])[\.\)]\s*(.+)$/i;
const questionStart = /^(\d+)[\.\)]\s*(.+)$/;
const answerOnly = /^(?:Đáp\s*án\s*:?\s*)?([A-F]{1,6})$/i;

type CurrentQuestion = {
  number: string;
  question: string[];
  options: Partial<Record<OptionLabel, string>>;
  answers: OptionLabel[];
};

function normalize(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function expectedLabels(raw: Partial<Record<OptionLabel, string>>) {
  const highest = Math.max(3, ...optionLabels.map((label, index) => (raw[label] ? index : -1)));
  return optionLabels.slice(0, highest + 1);
}

function makeOptions(raw: Partial<Record<OptionLabel, string>>): Option[] {
  return expectedLabels(raw).map((label) => ({
    id: uid("option"),
    label,
    text: raw[label]?.trim() ?? ""
  }));
}

function parseAnswerLabels(value: string): OptionLabel[] {
  const labels = value
    .toUpperCase()
    .replace(/[^A-F]/g, "")
    .split("")
    .filter((label): label is OptionLabel => optionLabels.includes(label as OptionLabel));
  return Array.from(new Set(labels));
}

function pushQuestion(blocks: Question[], errors: string[], current: CurrentQuestion | null) {
  if (!current) return;
  const questionText = current.question.join(" ").replace(/\s+/g, " ").trim();
  if (!questionText) return;

  const options = makeOptions(current.options);
  const missing = options.filter((option) => !option.text).map((option) => option.label);
  if (missing.length) {
    errors.push(`Câu ${current.number}: thiếu đáp án ${missing.join(", ")}.`);
  }
  if (!current.answers.length) {
    errors.push(`Câu ${current.number}: chưa nhận diện được đáp án đúng.`);
  }
  const correctOptions = current.answers
    .map((label) => options.find((option) => option.label === label))
    .filter((option): option is Option => Boolean(option));
  const fallback = correctOptions[0] ?? options[0];
  blocks.push({
    id: uid("question"),
    questionText,
    keywords: [],
    options,
    correctOptionId: fallback.id,
    correctOptionIds: correctOptions.length ? correctOptions.map((option) => option.id) : [fallback.id]
  });
}

export function parseQuizText(text: string): Question[] {
  return parseQuizTextWithErrors(text).questions;
}

export function parseQuizTextWithErrors(text: string): ParseResult {
  const lines = normalize(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const questions: Question[] = [];
  const errors: string[] = [];
  let current: CurrentQuestion | null = null;
  let activeOption: OptionLabel | null = null;
  let autoNumber = 1;

  function makeQuestion(firstLine: string, number?: string): CurrentQuestion {
    return {
      number: number ?? `không đánh số ${autoNumber++}`,
      question: [firstLine],
      options: {},
      answers: []
    };
  }

  for (const line of lines) {
    const numbered = line.match(questionStart);
    if (numbered) {
      pushQuestion(questions, errors, current);
      current = makeQuestion(numbered[2], numbered[1]);
      activeOption = null;
      continue;
    }

    const option = line.match(optionLine);
    if (option) {
      if (!current) {
        errors.push(`Gặp đáp án ${option[1].toUpperCase()} nhưng chưa có nội dung câu hỏi phía trước.`);
        continue;
      }
      activeOption = option[1].toUpperCase() as OptionLabel;
      current.options[activeOption] = option[2].trim();
      continue;
    }

    if (!current) {
      current = makeQuestion(line);
      activeOption = null;
      continue;
    }

    const answer = line.match(answerOnly);
    if (answer) {
      const labels = parseAnswerLabels(answer[1]);
      if (labels.length) {
        current.answers = labels;
        activeOption = null;
        continue;
      }
    }

    const labelsToCheck = current ? expectedLabels(current.options) : optionLabels.slice(0, 4);
    const hasAllOptions = labelsToCheck.every((label) => Boolean(current?.options[label]));
    if (current.answers.length && hasAllOptions) {
      pushQuestion(questions, errors, current);
      current = makeQuestion(line);
      activeOption = null;
      continue;
    }

    if (activeOption) {
      current.options[activeOption] = `${current.options[activeOption]} ${line}`.trim();
    } else {
      current.question.push(line);
    }
  }

  pushQuestion(questions, errors, current);
  if (!questions.length) {
    errors.push("Không tìm thấy câu hỏi. Hãy kiểm tra định dạng nội dung câu, đáp án A-F và dòng đáp án đúng.");
  }
  return { questions, errors };
}
