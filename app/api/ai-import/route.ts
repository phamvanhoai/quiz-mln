import { NextResponse } from "next/server";
import type { AppSettings } from "@/lib/settings";
import { splitImportText } from "@/lib/text-chunks";
import type { OptionLabel, Question } from "@/lib/types";
import { uid } from "@/lib/utils";

export const maxDuration = 120;

type GeminiPart = { text?: string };
type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  error?: { message?: string };
};

type AiQuestion = {
  questionText?: string;
  keywords?: string[];
  options?: Partial<Record<OptionLabel, string>>;
  correctAnswer?: OptionLabel;
  explanation?: string;
};

const labels: OptionLabel[] = ["A", "B", "C", "D"];

function extractJson(text: string) {
  const trimmed = text.trim();
  const withoutFence = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
    : trimmed;
  const first = withoutFence.search(/[\[{]/);
  if (first < 0) return withoutFence;

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = first; index < withoutFence.length; index += 1) {
    const char = withoutFence[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") inString = false;
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }
    if (char === "}" || char === "]") {
      const open = stack.pop();
      if ((char === "}" && open !== "{") || (char === "]" && open !== "[")) break;
      if (!stack.length) return withoutFence.slice(first, index + 1);
    }
  }

  return withoutFence.slice(first);
}

function normalizeQuestions(items: AiQuestion[]): Question[] {
  return items
    .filter((item) => item.questionText && item.options && item.correctAnswer)
    .map((item) => {
      const options = labels.map((label) => ({
        id: uid("option"),
        label,
        text: item.options?.[label]?.trim() ?? ""
      }));
      const correct = options.find((option) => option.label === item.correctAnswer) ?? options[0];
      const questionText = item.questionText?.trim() ?? "";
      const keywords = (item.keywords ?? [])
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .map((keyword) => {
          const startIndex = questionText.toLowerCase().indexOf(keyword.toLowerCase());
          return {
            id: uid("keyword"),
            text: keyword,
            startIndex: startIndex >= 0 ? startIndex : undefined,
            endIndex: startIndex >= 0 ? startIndex + keyword.length : undefined
          };
        });

      return {
        id: uid("question"),
        questionText,
        keywords,
        options,
        correctOptionId: correct.id,
        explanation: item.explanation?.trim() || undefined
      };
    });
}

function dedupeQuestions(questions: Question[]) {
  const seen = new Set<string>();
  const result: Question[] = [];

  for (const question of questions) {
    const key = [question.questionText, ...question.options.map((option) => `${option.label}:${option.text}`)]
      .join("|")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(question);
  }

  return result;
}

function buildPrompt(text: string, index: number, total: number) {
  return `Bạn là parser dữ liệu quiz trắc nghiệm tiếng Việt.
Đây là phần ${index}/${total} của một tài liệu lớn. Hãy trích xuất TẤT CẢ câu hỏi trắc nghiệm có trong phần này, không chỉ lấy ví dụ hoặc 10 câu đầu.

Yêu cầu:
- Tách câu hỏi dù có hoặc không có số thứ tự.
- Nhận diện đáp án A, B, C, D kể cả khi bị dính dòng.
- Nhận diện đáp án đúng nếu có dòng A/B/C/D đứng riêng hoặc "Đáp án: A".
- Nếu câu bị cắt mất đầu/cuối do chia phần và không đủ A/B/C/D hoặc không có đáp án đúng, bỏ qua câu đó.
- Giữ nguyên tiếng Việt.
- Keywords để [] nếu không chắc.
- Không bịa câu hỏi, không bịa đáp án đúng.
- Chỉ trả về đúng MỘT JSON object hợp lệ theo schema. Không markdown, không giải thích, không thêm object thứ hai phía sau.

Schema JSON:
{
  "questions": [
    {
      "questionText": "string",
      "keywords": ["string"],
      "options": { "A": "string", "B": "string", "C": "string", "D": "string" },
      "correctAnswer": "A|B|C|D",
      "explanation": "string optional"
    }
  ]
}

Nội dung phần ${index}/${total}:
${text}`;
}

async function callGemini(apiKey: string, model: string, prompt: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 85000);
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          maxOutputTokens: 65536
        }
      })
    });
  } finally {
    clearTimeout(timer);
  }

  const data = (await response.json()) as GeminiResponse;
  if (!response.ok) {
    throw new Error(data.error?.message ?? "Gemini API trả về lỗi.");
  }

  const raw = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  let parsed: { questions?: AiQuestion[] };
  try {
    parsed = JSON.parse(extractJson(raw)) as { questions?: AiQuestion[] };
  } catch (error) {
    throw new Error(`Không parse được JSON AI trả về: ${error instanceof Error ? error.message : "JSON lỗi."}`);
  }
  return normalizeQuestions(parsed.questions ?? []);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    text?: string;
    settings?: Partial<AppSettings>;
    chunkIndex?: number;
    chunkCount?: number;
  };
  const apiKey = body.settings?.googleAiApiKey || process.env.GOOGLE_AI_API_KEY;
  const model = body.settings?.googleAiModel || process.env.GOOGLE_AI_MODEL || "gemini-2.5-flash";
  if (!apiKey) {
    return NextResponse.json(
      { error: "Thiếu Google AI API key. Vào trang Cấu hình để nhập key hoặc thêm GOOGLE_AI_API_KEY trong .env." },
      { status: 400 }
    );
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Không có nội dung để parse." }, { status: 400 });
  }

  if (typeof body.chunkIndex === "number" && typeof body.chunkCount === "number") {
    try {
      const questions = await callGemini(apiKey, model, buildPrompt(text, body.chunkIndex + 1, body.chunkCount));
      return NextResponse.json({
        questions,
        rawCount: questions.length,
        chunkCount: body.chunkCount,
        chunkIndex: body.chunkIndex,
        chunkErrors: []
      });
    } catch (error) {
      return NextResponse.json(
        {
          questions: [],
          rawCount: 0,
          chunkCount: body.chunkCount,
          chunkIndex: body.chunkIndex,
          chunkErrors: [`Phần ${body.chunkIndex + 1}/${body.chunkCount}: ${error instanceof Error ? error.message : "AI import lỗi."}`]
        },
        { status: 200 }
      );
    }
  }

  const chunks = splitImportText(text);
  const questions: Question[] = [];
  const chunkErrors: string[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    try {
      const chunkQuestions = await callGemini(apiKey, model, buildPrompt(chunks[index], index + 1, chunks.length));
      questions.push(...chunkQuestions);
    } catch (error) {
      chunkErrors.push(`Phần ${index + 1}/${chunks.length}: ${error instanceof Error ? error.message : "AI import lỗi."}`);
    }
  }

  const deduped = dedupeQuestions(questions);
  return NextResponse.json({
    questions: deduped,
    rawCount: questions.length,
    chunkCount: chunks.length,
    chunkErrors
  });
}
