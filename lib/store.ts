"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProgressMap, Question, QuizSet } from "@/lib/types";
import { sampleSet } from "@/lib/sample";
import { nowIso, uid } from "@/lib/utils";

const setsKey = "quiz-mln.sets";
const progressKey = "quiz-mln.progress";
const themeKey = "quiz-mln.theme";

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

export function useQuizStore() {
  const [sets, setSets] = useState<QuizSet[]>([]);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [loaded, setLoaded] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const savedSets = readJson<QuizSet[]>(setsKey, []);
    setSets(savedSets.length ? savedSets : [sampleSet]);
    setProgress(readJson<ProgressMap>(progressKey, {}));
    const savedTheme = window.localStorage.getItem(themeKey);
    const enabled = savedTheme ? savedTheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(enabled);
    document.documentElement.classList.toggle("dark", enabled);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) writeJson(setsKey, sets);
  }, [loaded, sets]);

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
      return exists ? items.map((item) => (item.id === set.id ? next : item)) : [next, ...items];
    });
  }, []);

  const createSet = useCallback((title: string, questions: Question[] = []) => {
    const set: QuizSet = { id: uid("set"), title, questions, createdAt: nowIso(), updatedAt: nowIso() };
    setSets((items) => [set, ...items]);
    return set.id;
  }, []);

  const deleteSet = useCallback((setId: string) => {
    setSets((items) => items.filter((item) => item.id !== setId));
  }, []);

  const renameSet = useCallback((setId: string, title: string) => {
    setSets((items) => items.map((item) => (item.id === setId ? { ...item, title, updatedAt: nowIso() } : item)));
  }, []);

  const updateQuestion = useCallback((setId: string, question: Question) => {
    setSets((items) =>
      items.map((set) =>
        set.id === setId
          ? { ...set, updatedAt: nowIso(), questions: set.questions.map((item) => (item.id === question.id ? question : item)) }
          : set
      )
    );
  }, []);

  const addQuestion = useCallback((setId: string, question: Question) => {
    setSets((items) =>
      items.map((set) => (set.id === setId ? { ...set, updatedAt: nowIso(), questions: [...set.questions, question] } : set))
    );
  }, []);

  const deleteQuestion = useCallback((setId: string, questionId: string) => {
    setSets((items) =>
      items.map((set) =>
        set.id === setId ? { ...set, updatedAt: nowIso(), questions: set.questions.filter((q) => q.id !== questionId) } : set
      )
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
