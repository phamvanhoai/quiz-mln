import type { Option, OptionLabel, ParseResult, Question } from "@/lib/types";
import { uid } from "@/lib/utils";

const optionLabels: OptionLabel[] = ["A", "B", "C", "D"];
const optionLine = /^([A-D])[\.\)]\s*(.+)$/i;
const questionStart = /^(\d+)[\.\)]\s*(.+)$/;
const answerOnly = /^(?:Đáp\s*án\s*:?\s*)?([A-D])$/i;

type CurrentQuestion = {
  number: string;
  question: string[];
  options: Record<OptionLabel, string>;
  answer?: OptionLabel;
};

function normalize(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function makeOptions(raw: Record<OptionLabel, string>): Option[] {
  return optionLabels.map((label) => ({
    id: uid("option"),
    label,
    text: raw[label]?.trim() ?? ""
  }));
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
  if (!current.answer) {
    errors.push(`Câu ${current.number}: chưa nhận diện được đáp án đúng.`);
  }
  const correct = options.find((option) => option.label === current.answer) ?? options[0];
  blocks.push({
    id: uid("question"),
    questionText,
    keywords: [],
    options,
    correctOptionId: correct.id
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
      options: { A: "", B: "", C: "", D: "" }
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
    if (answer && optionLabels.includes(answer[1].toUpperCase() as OptionLabel)) {
      current.answer = answer[1].toUpperCase() as OptionLabel;
      activeOption = null;
      continue;
    }

    const hasAllOptions = optionLabels.every((label) => Boolean(current?.options[label]));
    if (current.answer && hasAllOptions) {
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
    errors.push("Không tìm thấy câu hỏi. Hãy kiểm tra định dạng nội dung câu, đáp án A-D và dòng đáp án đúng.");
  }
  return { questions, errors };
}
