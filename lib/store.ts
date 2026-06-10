"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OptionLabel, ProgressMap, Question, QuizSet } from "@/lib/types";
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
  visibility: "private" | "shared" | "public" | null;
  created_by: string | null;
  created_by_email: string | null;
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
  label: OptionLabel;
  text: string;
  position: number;
};

type CloudQuestionRow = {
  id: string;
  question_text: string;
  correct_option_id: string;
  correct_option_ids: string[] | null;
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

type SupabaseMaybeError = {
  error: null | {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  };
};

type ProgressRow = {
  user_id: string;
  question_id: string;
  learned: boolean;
  starred: boolean;
  wrong_count: number;
  correct_streak: number;
  updated_at: string;
};

function chunkRows<T>(rows: T[], size = 300) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function throwIfSupabaseError(result: SupabaseMaybeError, action: string) {
  if (!result.error) return;
  const details = [result.error.message, result.error.details, result.error.hint, result.error.code].filter(Boolean).join(" | ");
  throw new Error(`${action}: ${details || "Supabase error"}`);
}

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
      correctOptionIds: question.correct_option_ids?.length ? question.correct_option_ids : [question.correct_option_id],
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
    updatedAt: row.updated_at,
    createdBy: row.created_by ?? undefined,
    createdByEmail: row.created_by_email ?? undefined,
    visibility: row.visibility ?? "public"
  };
}

async function saveSetsToCloud(supabase: NonNullable<ReturnType<typeof createClient>>, sets: QuizSet[], user: { id: string; email?: string | null } | null) {
  if (!user) return;
  const syncableSets = sets.filter((set) => set.id !== sampleSetId && (!set.createdBy || set.createdBy === user.id));
  if (!syncableSets.length) return;

  for (const set of syncableSets) {
    throwIfSupabaseError(await supabase.rpc("save_quiz_set", { payload: set }), "Luu bo de");
  }
}
function persistSets(sets: QuizSet[]) {
  return sets;
}

export function useQuizStore() {
  const [sets, setSets] = useState<QuizSet[]>([]);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [loaded, setLoaded] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudConfig, setCloudConfig] = useState<{ url?: string; key?: string }>({});
  const [cloudEnabled, setCloudEnabled] = useState(hasSupabaseConfig());
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [progressCloudReady, setProgressCloudReady] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const settings = readSettings();
    const config = { url: settings.supabaseUrl, key: settings.supabasePublishableKey };
    setCloudConfig(config);
    setCloudEnabled(hasSupabaseConfig(config));
    setSets([]);
    setProgress({});
    window.localStorage.removeItem(setsKey);
    window.localStorage.removeItem(progressKey);
    const savedTheme = window.localStorage.getItem(themeKey);
    const enabled = savedTheme ? savedTheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(enabled);
    document.documentElement.classList.toggle("dark", enabled);
    setLoaded(true);

    const supabase = createClient(config);
    if (supabase) {
      supabase.auth.getUser().then(({ data }) => {
        setUserId(data.user?.id ?? null);
        setUserEmail(data.user?.email ?? null);
        setAuthReady(true);
      });
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        setUserId(session?.user?.id ?? null);
        setUserEmail(session?.user?.email ?? null);
        setAuthReady(true);
      });
      return () => listener.subscription.unsubscribe();
    }
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (!loaded || !cloudEnabled) {
      setSets([]);
      setCloudReady(true);
      return;
    }
    if (!authReady) return;

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
          visibility,
          created_at,
          updated_at,
          created_by,
          created_by_email,
          quiz_set_questions (
            position,
            questions (
              id,
              question_text,
              correct_option_id,
              correct_option_ids,
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
      setSets(cloudSets);
      setCloudReady(true);
    }

    loadCloud();
    return () => {
      cancelled = true;
    };
  }, [authReady, cloudConfig, cloudEnabled, loaded, userId, userEmail]);

  const persistSetToCloud = useCallback(async (set: QuizSet, throwOnError = false) => {
    if (!cloudEnabled) return;
    const supabase = createClient(cloudConfig);
    if (!supabase) return;
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error(authError?.message || "Bạn cần đăng nhập trước khi lưu bộ đề lên Supabase.");
      }
      const ownedSet = {
        ...set,
        createdBy: set.createdBy ?? authData.user.id,
        createdByEmail: set.createdByEmail ?? authData.user.email ?? undefined
      };
      await saveSetsToCloud(supabase, [ownedSet], { id: authData.user.id, email: authData.user.email });
      setCloudError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      setCloudError(message);
      if (throwOnError) throw new Error(message);
    }
  }, [cloudConfig, cloudEnabled]);

  useEffect(() => {
    setProgressCloudReady(false);
    if (!loaded || !cloudEnabled || !userId) {
      setProgress({});
      setProgressCloudReady(true);
      return;
    }
    const supabase = createClient(cloudConfig);
    if (!supabase) {
      setProgress({});
      setProgressCloudReady(true);
      return;
    }

    let cancelled = false;
    setProgress({});
    supabase
      .from("user_question_progress")
      .select("user_id, question_id, learned, starred, wrong_count, correct_streak, updated_at")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setCloudError(error.message);
          setProgressCloudReady(true);
          return;
        }
        const cloudProgress: ProgressMap = {};
        for (const row of (data ?? []) as ProgressRow[]) {
          cloudProgress[row.question_id] = {
            learned: row.learned,
            starred: row.starred,
            wrongCount: row.wrong_count,
            correctStreak: row.correct_streak
          };
        }
        setProgress(cloudProgress);
        setProgressCloudReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [cloudConfig, cloudEnabled, loaded, userId]);

  useEffect(() => {
    if (!loaded || !cloudEnabled || !progressCloudReady || !userId) return;
    const supabase = createClient(cloudConfig);
    if (!supabase) return;
    const rows = Object.entries(progress).map(([questionId, item]) => ({
      user_id: userId,
      question_id: questionId,
      learned: item.learned,
      starred: item.starred,
      wrong_count: item.wrongCount,
      correct_streak: item.correctStreak,
      updated_at: nowIso()
    }));
    if (!rows.length) return;

    const timer = window.setTimeout(async () => {
      try {
        for (const chunk of chunkRows(rows)) {
          throwIfSupabaseError(await supabase.from("user_question_progress").upsert(chunk, { onConflict: "user_id,question_id" }), "Lưu tiến trình học");
        }
      } catch (error) {
        setCloudError(error instanceof Error ? error.message : JSON.stringify(error));
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [cloudConfig, cloudEnabled, loaded, progress, progressCloudReady, userId]);

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
      void persistSetToCloud(next);
      return persistSets(exists ? items.map((item) => (item.id === set.id ? next : item)) : [next, ...items]);
    });
  }, [persistSetToCloud]);

  const buildNewSet = useCallback((title: string, questions: Question[] = []): QuizSet => ({
    id: uid("set"),
    title,
    questions,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdBy: userId ?? undefined,
    createdByEmail: userEmail ?? undefined,
    visibility: "private"
  }), [userEmail, userId]);

  const createSet = useCallback((title: string, questions: Question[] = []) => {
    const set = buildNewSet(title, questions);
    void persistSetToCloud(set);
    setSets((items) => persistSets([set, ...items.filter((item) => item.id !== sampleSetId)]));
    return set.id;
  }, [buildNewSet, persistSetToCloud]);

  const createSetAsync = useCallback(async (title: string, questions: Question[] = []) => {
    if (cloudEnabled && !userId) {
      throw new Error("Bạn cần đăng nhập trước khi lưu bộ đề lên Supabase.");
    }
    const set = buildNewSet(title, questions);
    await persistSetToCloud(set, true);
    setSets((items) => persistSets([set, ...items.filter((item) => item.id !== sampleSetId)]));
    return set.id;
  }, [buildNewSet, cloudEnabled, persistSetToCloud, userId]);

  const deleteSet = useCallback((setId: string) => {
    setSets((items) => persistSets(items.filter((item) => item.id !== setId)));
    const supabase = createClient(cloudConfig);
    if (supabase) {
      supabase
        .rpc("delete_quiz_set_with_questions", { target_set_id: setId })
        .then(({ error }) => setCloudError(error?.message ?? null));
    }
  }, [cloudConfig]);

  const renameSet = useCallback((setId: string, title: string) => {
    setSets((items) => {
      let changed: QuizSet | null = null;
      const nextItems = items.map((item) => {
        if (item.id !== setId) return item;
        changed = { ...item, title, updatedAt: nowIso() };
        return changed;
      });
      if (changed) void persistSetToCloud(changed);
      return persistSets(nextItems);
    });
  }, [persistSetToCloud]);

  const updateQuestion = useCallback((setId: string, question: Question) => {
    setSets((items) => {
      let changed: QuizSet | null = null;
      const nextItems = items.map((set) => {
        if (set.id !== setId) return set;
        changed = { ...set, updatedAt: nowIso(), questions: set.questions.map((item) => (item.id === question.id ? question : item)) };
        return changed;
      });
      if (changed) void persistSetToCloud(changed);
      return persistSets(nextItems);
    });
  }, [persistSetToCloud]);

  const addQuestion = useCallback((setId: string, question: Question) => {
    setSets((items) => {
      let changed: QuizSet | null = null;
      const nextItems = items.map((set) => {
        if (set.id !== setId) return set;
        changed = { ...set, updatedAt: nowIso(), questions: [...set.questions, question] };
        return changed;
      });
      if (changed) void persistSetToCloud(changed);
      return persistSets(nextItems);
    });
  }, [persistSetToCloud]);

  const deleteQuestion = useCallback((setId: string, questionId: string) => {
    setSets((items) => {
      let changed: QuizSet | null = null;
      const nextItems = items.map((set) => {
        if (set.id !== setId) return set;
        changed = { ...set, updatedAt: nowIso(), questions: set.questions.filter((q) => q.id !== questionId) };
        return changed;
      });
      if (changed) void persistSetToCloud(changed);
      return persistSets(nextItems);
    });
  }, [persistSetToCloud]);

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
    userId,
    userEmail,
    sets,
    progress,
    dark,
    allQuestions,
    toggleDark,
    saveSet,
    createSet,
    createSetAsync,
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
