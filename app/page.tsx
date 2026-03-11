"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import PersonalStreak, { calcStreakForUser } from "@/components/PersonalStreak";
import NotificationBell from "@/components/NotificationBell";

interface Challenge {
  id: string;
  task_description: string;
  deposit_amount: number;
  status: string;
  created_at: string;
  stripe_payment_intent_id: string | null;
}

interface Workout {
  id: string;
  image_url: string;
  user_name: string | null;
  created_at: string;
  caption?: string | null;
}

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading, displayName, signOut } = useAuth();
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(true);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    // アクティブなチャレンジを取得
    const { data: challenge } = await supabase
      .from("challenges")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    setActiveChallenge(challenge ?? null);
    setLoadingChallenge(false);

    // ストリーク計算用にワークアウト取得
    const { data: wks } = await supabase
      .from("workouts")
      .select("*")
      .order("created_at", { ascending: false });
    setWorkouts(wks ?? []);
  }, [user]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  useEffect(() => {
    if (displayName && workouts.length >= 0) {
      setStreak(calcStreakForUser(workouts, displayName));
    }
  }, [workouts, displayName]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  const getAvatarColor = (name: string | null) => {
    if (!name) return "from-zinc-500 to-zinc-600";
    const colors = [
      "from-red-500 to-rose-600",
      "from-orange-500 to-red-600",
      "from-rose-500 to-pink-600",
      "from-red-600 to-orange-600",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitial = (name: string | null) => (name ? name.charAt(0).toUpperCase() : "?");

  const getDaysLeft = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const daysElapsed = Math.floor(diff / 86400000);
    return Math.max(0, 30 - daysElapsed);
  };

  if (authLoading || !user) {
    return (
      <div className="gradient-bg flex min-h-dvh items-center justify-center">
        <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
      </div>
    );
  }

  return (
    <div className="gradient-bg flex min-h-dvh flex-col items-center px-4 pb-24 pt-16">
      {/* ヘッダー */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-zinc-800/60 bg-zinc-950/80 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(displayName)} text-xs font-bold text-white`}>
            {getInitial(displayName)}
          </div>
          <span className="text-sm font-medium text-zinc-300">{displayName}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`text-xl ${streak > 0 ? "drop-shadow-[0_0_6px_rgba(249,115,22,0.6)]" : "opacity-30"}`}>🔥</span>
          <span className={`text-lg font-bold tabular-nums ${streak > 0 ? "bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent" : "text-zinc-600"}`}>
            {streak}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell currentUserDisplayName={displayName} />
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-all hover:border-zinc-500 hover:text-zinc-200 active:scale-95"
          >
            ログアウト
          </button>
        </div>
      </div>

      <div className="mt-4 w-full max-w-sm">
        {/* PersonalStreak */}
        <PersonalStreak workouts={workouts} displayName={displayName} streak={streak} />

        <div className="mt-6 flex flex-col gap-4">
          {loadingChallenge ? (
            <div className="flex justify-center py-10">
              <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
            </div>
          ) : activeChallenge ? (
            /* ── アクティブなチャレンジ表示 ── */
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-red-900/40 bg-gradient-to-b from-zinc-900 to-zinc-950 p-5 shadow-xl shadow-red-950/20">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-400">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    進行中のチャレンジ
                  </span>
                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-400 border border-red-500/20">
                    残り {getDaysLeft(activeChallenge.created_at)} 日
                  </span>
                </div>

                <p className="mb-4 text-base font-bold leading-relaxed text-white">
                  {activeChallenge.task_description}
                </p>

                <div className="flex items-center justify-between rounded-xl bg-zinc-800/60 px-4 py-3">
                  <span className="text-xs text-zinc-500">デポジット</span>
                  <span className="text-lg font-black text-red-400">
                    ¥{activeChallenge.deposit_amount.toLocaleString()}
                  </span>
                </div>

                <p className="mt-3 text-center text-xs text-zinc-600">
                  サボれば仲間に没収される。逃げるな。
                </p>
              </div>

              {/* スクワッドへのリンク */}
              <Link
                href="/squad"
                className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900/60 py-4 text-sm font-semibold text-zinc-300 transition-all hover:border-zinc-500 hover:text-white active:scale-[0.97]"
              >
                👥 スクワッドのタイムラインを見る
              </Link>
            </div>
          ) : (
            /* ── チャレンジなし ── */
            <div className="flex flex-col gap-6 text-center">
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-800 px-6 py-10">
                <span className="text-5xl opacity-60">⛓️</span>
                <h2 className="text-lg font-bold text-white">まだ宣言していない</h2>
                <p className="text-sm leading-relaxed text-zinc-500">
                  チャレンジを宣言してデポジットを積めば、<br />逃げ場はなくなる。
                </p>
              </div>

              <Link
                href="/challenges/new"
                className="btn-glow flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 py-4 text-base font-black text-white shadow-xl shadow-red-500/25 transition-all duration-300 hover:brightness-110 active:scale-[0.97]"
              >
                ⛓️ 新しいチャレンジを宣言する
              </Link>
            </div>
          )}
        </div>
      </div>

      <footer className="mt-12 text-xs text-zinc-700">Streak Squad &copy; 2026</footer>
    </div>
  );
}
