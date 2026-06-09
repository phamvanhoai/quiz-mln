import type { QuizSet } from "@/lib/types";
import { nowIso, uid } from "@/lib/utils";

const qId = uid("question");
const aId = uid("option");

export const sampleSet: QuizSet = {
  id: "sample-mln111",
  title: "Mẫu ôn tập MLN111",
  createdAt: nowIso(),
  updatedAt: nowIso(),
  questions: [
    {
      id: qId,
      questionText: "Xanh-ximông là đại biểu của trường phái nào?",
      keywords: [{ id: uid("keyword"), text: "Xanh-ximông", startIndex: 0, endIndex: 11 }],
      correctOptionId: aId,
      options: [
        { id: aId, label: "A", text: "Chủ nghĩa xã hội không tưởng Pháp" },
        { id: uid("option"), label: "B", text: "Chủ nghĩa xã hội không tưởng Đức" },
        { id: uid("option"), label: "C", text: "Triết học cổ điển Đức" },
        { id: uid("option"), label: "D", text: "Kinh tế chính trị học Anh" }
      ],
      explanation: "Xanh-ximông là một đại biểu tiêu biểu của chủ nghĩa xã hội không tưởng Pháp."
    }
  ]
};
