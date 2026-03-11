"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

interface Challenge {
  id: string;
  task_description: string;
  deposit_amount: number;
  status: string;
  created_at: string;
}

const BIG3_KEYS = ["bench", "squat", "deadlift"] as const;
const BIG3_LABELS: Record<string, string> = {
  bench: "ベンチプレス",
  squat: "スクワット",
  deadlift: "デッドリフト",
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "進行中", color: "text-red-400 bg-red-500/10 border-red-500/20" },
  completed: { label: "達成", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  failed: { label: "失敗", color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" },
  escaped: { label: "逃亡", color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading, displayName, signOut } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [big3, setBig3] = useState({ bench: "", squat: "", deadlift: "" });
  const [editingBig3, setEditingBig3] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  const fetchChallenges = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("challenges")
      .select("id, task_description, deposit_amount, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setChallenges(data ?? []);
    setLoadingChallenges(false);
  }, [user]);

  useEffect(() => {
    if (user) fetchChallenges();
  }, [user, fetchChallenges]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  const getAvatarColor = (name: string | null) => {
    if (!name) return "from-zinc-500 to-zinc-600";
    const colors = ["from-red-500 to-rose-600", "from-orange-500 to-red-600", "from-rose-500 to-pink-600"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });

  const totalDeposit = challenges.reduce((sum, c) => sum + c.deposit_amount, 0);
  const completedCount = challenges.filter((c) => c.status === "completed").length;

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
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-zinc-800/60 bg-zinc-950/80 px-4 py-3 backdrop-blur-md">
        <span className="text-sm font-bold text-white">👤 プロフィール</span>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
        >
          ログアウト
        </button>
      </div>

      <div className="mt-4 w-full max-w-sm flex flex-col gap-5">
        {/* ユーザー情報 */}
        <div className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${getAvatarColor(displayName)} text-2xl font-black text-white shadow-lg`}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-lg font-black text-white">{displayName}</p>
            <p className="text-xs text-zinc-500">{user.email}</p>
            <p className="text-xs text-zinc-600 mt-1">ID: {user.id.slice(0, 8)}...</p>
          </div>
        </div>

        {/* 統計 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "チャレンジ数", value: challenges.length, icon: "⛓️" },
            { label: "達成数", value: completedCount, icon: "✅" },
            { label: "総デポジット", value: `¥${(totalDeposit / 1000).toFixed(0)}k`, icon: "💰" },
          ].map(({ label, value, icon }) => (
            <div key={label} className="flex flex-col items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 py-4">
              <span className="text-xl">{icon}</span>
              <span className="text-lg font-black text-white">{value}</span>
              <span className="text-[10px] text-zinc-600 text-center">{label}</span>
            </div>
          ))}
        </div>

        {/* BIG3記録 */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-white">🏋️ BIG3 自己ベスト</h2>
            <button
              type="button"
              onClick={() => setEditingBig3((v) => !v)}
              className="text-xs text-red-400 hover:text-red-300 font-semibold"
            >
              {editingBig3 ? "保存" : "編集"}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {BIG3_KEYS.map((key) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">{BIG3_LABELS[key]}</span>
                {editingBig3 ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={big3[key]}
                      onChange={(e) => setBig3((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder="0"
                      className="w-20 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-right text-sm text-white outline-none focus:border-red-500/60"
                    />
                    <span className="text-xs text-zinc-500">kg</span>
                  </div>
                ) : (
                  <span className="text-base font-bold text-white">
                    {big3[key] ? `${big3[key]} kg` : <span className="text-zinc-600 text-sm">未記録</span>}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 過去のチャレンジ */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-black text-white">📜 過去の戦績</h2>

          {loadingChallenges ? (
            <div className="flex justify-center py-6">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
            </div>
          ) : challenges.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-800 py-8 text-center">
              <span className="text-3xl opacity-30">📜</span>
              <p className="text-sm text-zinc-600">まだ戦績なし</p>
            </div>
          ) : (
            challenges.map((c) => {
              const s = STATUS_MAP[c.status] ?? { label: c.status, color: "text-zinc-400 bg-zinc-800 border-zinc-700" };
              return (
                <div key={c.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-200 flex-1 leading-relaxed">{c.task_description}</p>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${s.color}`}>
                      {s.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-600">
                    <span>{formatDate(c.created_at)}</span>
                    <span className="font-semibold text-zinc-400">¥{c.deposit_amount.toLocaleString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
