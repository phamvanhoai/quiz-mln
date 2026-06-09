"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProgressMap, Question, QuizSet } from "@/lib/types";
import { sampleSet } from "@/lib/sample";
import { readSettings } from "@/lib/settings";
import { nowIso, uid } from "@/lib/utils";
import { createClient, hasSupabaseConfig } from "@/utils/supabase/client";

const setsKey = "quiz-mln.sets";
const progressKey = "quiz-mln.progress";
const themeKey = "quiz-mln.theme";
const sampleSetId = "sample-mln111";

type QuizSetRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type CloudKeywordRow = {
  id: string;
  text: string;
  start_index: number | null;
  end_index: number | null;
};

type CloudOptionRow = {
  id: string;
  label: "A" | "B" | "C" | "D";
  text: string;
  position: number;
};

type CloudQuestionRow = {
  id: string;
  question_text: string;
  correct_option_id: string;
  explanation: string | null;
  options: CloudOptionRow[];
  keywords: CloudKeywordRow[];
};

type CloudSetQuestionRow = {
  position: number;
  questions: CloudQuestionRow | null;
};

type CloudQuizSetRow = QuizSetRow & {
  quiz_set_questions: CloudSetQuestionRow[];
};

function fromCloudSet(row: CloudQuizSetRow): QuizSet {
  const questions = (row.quiz_set_questions ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((join) => join.questions)
    .filter((question): question is CloudQuestionRow => Boolean(question))
    .map((question) => ({
      id: question.id,
      questionText: question.question_text,
      correctOptionId: question.correct_option_id,
      explanation: question.explanation ?? undefined,
      options: (question.options ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((option) => ({
          id: option.id,
          label: option.label,
          text: option.text
        })),
      keywords: (question.keywords ?? []).map((keyword) => ({
        id: keyword.id,
        text: keyword.text,
        startIndex: keyword.start_index ?? undefined,
        endIndex: keyword.end_index ?? undefined
      }))
    }));

  return {
    id: row.id,
    title: row.title,
    questions,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function saveSetsToCloud(supabase: NonNullable<ReturnType<typeof createClient>>, sets: QuizSet[]) {
  const syncableSets = sets.filter((set) => set.id !== sampleSetId);
  if (!syncableSets.length) return;

  const setRows = syncableSets.map((set) => ({
    id: set.id,
    title: set.title,
    created_at: set.createdAt,
    updated_at: set.updatedAt
  }));
  const questions = syncableSets.flatMap((set) => set.questions);
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const uniqueQuestions = Array.from(questionMap.values());
  const questionRows = uniqueQuestions.map((question) => ({
    id: question.id,
    question_text: question.questionText,
    correct_option_id: question.correctOptionId,
    explanation: question.explanation ?? null,
    updated_at: nowIso()
  }));
  const joinRows = syncableSets.flatMap((set) =>
    set.questions.map((question, index) => ({
      set_id: set.id,
      question_id: question.id,
      position: index
    }))
  );
  const optionRows = uniqueQuestions.flatMap((question) =>
    question.options.map((option, index) => ({
      id: option.id,
      question_id: question.id,
      label: option.label,
      text: option.text,
      position: index
    }))
  );
  const keywordRows = uniqueQuestions.flatMap((question) =>
    question.keywords.map((keyword) => ({
      id: keyword.id,
      question_id: question.id,
      text: keyword.text,
      start_index: keyword.startIndex ?? null,
      end_index: keyword.endIndex ?? null
    }))
  );
  const questionIds = uniqueQuestions.map((question) => question.id);
  const setIds = syncableSets.map((set) => set.id);

  const operations = [
    supabase.from("quiz_sets").upsert(setRows, { onConflict: "id" }),
    questionRows.length ? supabase.from("questions").upsert(questionRows, { onConflict: "id" }) : Promise.resolve({ error: null })
  ];
  for (const operation of operations) {
    const { error } = await operation;
    if (error) throw error;
  }

  if (setIds.length) {
    const { error } = await supabase.from("quiz_set_questions").delete().in("set_id", setIds);
    if (error) throw error;
  }
  if (questionIds.length) {
    const optionDelete = await supabase.from("options").delete().in("question_id", questionIds);
    if (optionDelete.error) throw optionDelete.error;
    const keywordDelete = await supabase.from("keywords").delete().in("question_id", questionIds);
    if (keywordDelete.error) throw keywordDelete.error;
  }

  if (joinRows.length) {
    const { error } = await supabase.from("quiz_set_questions").insert(joinRows);
    if (error) throw error;
  }
  if (optionRows.length) {
    const { error } = await supabase.from("options").insert(optionRows);
    if (error) throw error;
  }
  if (keywordRows.length) {
    const { error } = await supabase.from("keywords").insert(keywordRows);
    if (error) throw error;
  }
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function persistSets(sets: QuizSet[]) {
  writeJson(setsKey, sets);
  return sets;
}

function chooseBetterSet(current: QuizSet | undefined, incoming: QuizSet) {
  if (!current) return incoming;
  if (current.questions.length > incoming.questions.length) return current;
  if (incoming.questions.length > current.questions.length) return incoming;
  return new Date(incoming.updatedAt).getTime() >= new Date(current.updatedAt).getTime() ? incoming : current;
}

function mergeSets(localSets: QuizSet[], cloudSets: QuizSet[]) {
  const merged = new Map<string, QuizSet>();
  const localSource = cloudSets.length ? localSets.filter((set) => set.id !== sampleSetId) : localSets;

  for (const set of cloudSets) {
    merged.set(set.id, set);
  }
  for (const set of localSource) {
    merged.set(set.id, chooseBetterSet(merged.get(set.id), set));
  }

  const result = Array.from(merged.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return result.length ? result : [sampleSet];
}

function cleanupEmptyDuplicateSets(items: QuizSet[]) {
  const seenEmptyTitles = new Set<string>();
  return items.filter((set) => {
    if (set.id === sampleSetId) return items.length === 1;
    if (set.questions.length > 0) return true;
    const key = set.title.trim().toLowerCase();
    if (seenEmptyTitles.has(key)) return false;
    seenEmptyTitles.add(key);
    return true;
  });
}

export function useQuizStore() {
  const [sets, setSets] = useState<QuizSet[]>([]);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [loaded, setLoaded] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudConfig, setCloudConfig] = useState<{ url?: string; key?: string }>({});
  const [cloudEnabled, setCloudEnabled] = useState(hasSupabaseConfig());
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const savedSets = cleanupEmptyDuplicateSets(readJson<QuizSet[]>(setsKey, []));
    const settings = readSettings();
    const config = { url: settings.supabaseUrl, key: settings.supabasePublishableKey };
    setCloudConfig(config);
    setCloudEnabled(hasSupabaseConfig(config));
    setSets(savedSets.length ? savedSets : [sampleSet]);
    setProgress(readJson<ProgressMap>(progressKey, {}));
    const savedTheme = window.localStorage.getItem(themeKey);
    const enabled = savedTheme ? savedTheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(enabled);
    document.documentElement.classList.toggle("dark", enabled);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || !cloudEnabled) {
      setCloudReady(true);
      return;
    }

    let cancelled = false;
    async function loadCloud() {
      const supabase = createClient(cloudConfig);
      if (!supabase) {
        setCloudReady(true);
        return;
      }

      const { data, error } = await supabase
        .from("quiz_sets")
        .select(
          `
          id,
          title,
          created_at,
          updated_at,
          quiz_set_questions (
            position,
            questions (
              id,
              question_text,
              correct_option_id,
              explanation,
              options (id, label, text, position),
              keywords (id, text, start_index, end_index)
            )
          )
        `
        )
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        setCloudError(error.message);
        setCloudReady(true);
        return;
      }

      const cloudSets = ((data ?? []) as unknown as CloudQuizSetRow[]).map(fromCloudSet);
      if (cloudSets.length) {
        setSets((current) => persistSets(mergeSets(current, cloudSets)));
      }
      setCloudReady(true);
    }

    loadCloud();
    return () => {
      cancelled = true;
    };
  }, [cloudConfig, cloudEnabled, loaded]);

  useEffect(() => {
    if (loaded) writeJson(setsKey, sets);
  }, [loaded, sets]);

  useEffect(() => {
    if (!loaded || !cloudReady || !cloudEnabled || !sets.length) return;
    const supabase = createClient(cloudConfig);
    if (!supabase) return;

    const timer = window.setTimeout(async () => {
      try {
        await saveSetsToCloud(supabase, sets);
        setCloudError(null);
      } catch (error) {
        setCloudError(error instanceof Error ? error.message : "Không lưu được Supabase.");
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [cloudConfig, cloudEnabled, cloudReady, loaded, sets]);

  useEffect(() => {
    if (loaded) writeJson(progressKey, progress);
  }, [loaded, progress]);

  const toggleDark = useCallback(() => {
    setDark((value) => {
      const next = !value;
      document.documentElement.classList.toggle("dark", next);
      window.localStorage.setItem(themeKey, next ? "dark" : "light");
      return next;
    });
  }, []);

  const saveSet = useCallback((set: QuizSet) => {
    setSets((items) => {
      const exists = items.some((item) => item.id === set.id);
      const next = { ...set, updatedAt: nowIso() };
      return persistSets(exists ? items.map((item) => (item.id === set.id ? next : item)) : [next, ...items]);
    });
  }, []);

  const createSet = useCallback((title: string, questions: Question[] = []) => {
    const set: QuizSet = { id: uid("set"), title, questions, createdAt: nowIso(), updatedAt: nowIso() };
    setSets((items) => persistSets([set, ...items.filter((item) => item.id !== sampleSetId)]));
    return set.id;
  }, []);

  const deleteSet = useCallback((setId: string) => {
    setSets((items) => persistSets(items.filter((item) => item.id !== setId)));
    const supabase = createClient(cloudConfig);
    if (supabase) {
      supabase
        .from("quiz_sets")
        .delete()
        .eq("id", setId)
        .then(({ error }) => setCloudError(error?.message ?? null));
    }
  }, [cloudConfig]);

  const renameSet = useCallback((setId: string, title: string) => {
    setSets((items) => persistSets(items.map((item) => (item.id === setId ? { ...item, title, updatedAt: nowIso() } : item))));
  }, []);

  const updateQuestion = useCallback((setId: string, question: Question) => {
    setSets((items) =>
      persistSets(items.map((set) =>
        set.id === setId
          ? { ...set, updatedAt: nowIso(), questions: set.questions.map((item) => (item.id === question.id ? question : item)) }
          : set
      ))
    );
  }, []);

  const addQuestion = useCallback((setId: string, question: Question) => {
    setSets((items) =>
      persistSets(items.map((set) => (set.id === setId ? { ...set, updatedAt: nowIso(), questions: [...set.questions, question] } : set)))
    );
  }, []);

  const deleteQuestion = useCallback((setId: string, questionId: string) => {
    setSets((items) =>
      persistSets(items.map((set) =>
        set.id === setId ? { ...set, updatedAt: nowIso(), questions: set.questions.filter((q) => q.id !== questionId) } : set
      ))
    );
  }, []);

  const markAnswer = useCallback((questionId: string, correct: boolean) => {
    setProgress((items) => {
      const current = items[questionId] ?? { learned: false, starred: false, wrongCount: 0, correctStreak: 0 };
      return {
        ...items,
        [questionId]: {
          ...current,
          learned: true,
          wrongCount: correct ? current.wrongCount : current.wrongCount + 1,
          correctStreak: correct ? current.correctStreak + 1 : 0
        }
      };
    });
  }, []);

  const toggleStar = useCallback((questionId: string) => {
    setProgress((items) => {
      const current = items[questionId] ?? { learned: false, starred: false, wrongCount: 0, correctStreak: 0 };
      return { ...items, [questionId]: { ...current, starred: !current.starred } };
    });
  }, []);

  const clearWrong = useCallback((questionId: string) => {
    setProgress((items) => {
      const current = items[questionId];
      if (!current) return items;
      return { ...items, [questionId]: { ...current, wrongCount: 0, correctStreak: Math.max(current.correctStreak, 2) } };
    });
  }, []);

  const allQuestions = useMemo(() => sets.flatMap((set) => set.questions.map((question) => ({ set, question }))), [sets]);

  return {
    loaded,
    cloudEnabled,
    cloudReady,
    cloudError,
    sets,
    progress,
    dark,
    allQuestions,
    toggleDark,
    saveSet,
    createSet,
    deleteSet,
    renameSet,
    updateQuestion,
    addQuestion,
    deleteQuestion,
    markAnswer,
    toggleStar,
    clearWrong
  };
}
