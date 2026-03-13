"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { calcStreakForUser } from "@/components/PersonalStreak";
import { xpForNextLevel, getLevelTitle } from "@/lib/xp";

// ── 型定義 ──
interface Challenge {
  id: string;
  task_description: string;
  deposit_amount: number;
  status: string;
  created_at: string;
  freeze_active?: boolean;
}

interface Workout {
  id: string;
  image_url: string;
  user_name: string | null;
  created_at: string;
}

// ── ヘルパー ──
const toLocalDateStr = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function getMonthlyStats(workouts: Workout[], displayName: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();

  const myWorkouts = workouts.filter((w) => w.user_name === displayName);
  const submittedDays = new Set<string>();
  myWorkouts.forEach((w) => {
    const d = new Date(w.created_at);
    if (d.getFullYear() === year && d.getMonth() === month) {
      submittedDays.add(toLocalDateStr(d));
    }
  });

  return { daysInMonth, today, submittedDays, submittedCount: submittedDays.size };
}

function getWeeklyHeatmap(workouts: Workout[], displayName: string): boolean[] {
  const result: boolean[] = [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(todayStart.getTime() - i * 86_400_000);
    const dayStr = toLocalDateStr(dayStart);
    const submitted = workouts.some(
      (w) => w.user_name === displayName && toLocalDateStr(new Date(w.created_at)) === dayStr
    );
    result.push(submitted);
  }
  return result;
}

const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

// ── スクロールフェードイン ──
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function RevealSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════
// LP（未ログイン）
// ══════════════════════════════════════════════════
function LandingPage() {
  return (
    <div className="min-h-dvh bg-zinc-950 text-white overflow-hidden">
      {/* ヒーロー */}
      <section className="relative flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-red-600/10 blur-[120px]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
        </div>
        <div className="relative flex flex-col items-center gap-8">
          <div className="flex items-center gap-3">
            <span className="text-5xl drop-shadow-[0_0_24px_rgba(239,68,68,0.6)]">🔥</span>
            <h1 className="text-2xl font-black tracking-tight">Streak<span className="text-red-500">Squad</span></h1>
          </div>
          <div className="flex flex-col gap-4">
            <h2 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              習慣化か、<br /><span className="bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">罰金か。</span>
            </h2>
            <p className="mx-auto max-w-xs text-base leading-relaxed text-zinc-400">
              3,000円を賭けろ。<br />毎日やるか、没収されるか。<br /><span className="text-zinc-500">それだけのシンプルなルール。</span>
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Link href="/login" className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 py-4 text-base font-black text-white shadow-xl shadow-red-500/25 transition-all hover:brightness-110 active:scale-[0.97]">
              覚悟を決める
            </Link>
            <p className="text-xs text-zinc-600">無料アカウント作成 / ログイン</p>
          </div>
          <div className="mt-8 flex flex-col items-center gap-2 animate-bounce">
            <span className="text-xs text-zinc-600">ルールを知る</span>
            <svg className="h-5 w-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </section>

      {/* コンセプト */}
      <section className="relative px-6 py-24">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zinc-950 via-red-950/5 to-zinc-950" />
        <div className="relative mx-auto max-w-sm">
          <RevealSection>
            <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-red-500/80">Why Streak Squad?</p>
            <h3 className="mt-4 text-center text-2xl font-black leading-tight sm:text-3xl">意志の力に<br />頼るな。</h3>
            <p className="mt-4 text-center text-sm leading-relaxed text-zinc-400">
              「明日からやる」は一生来ない。<br />金を賭けて、仲間に監視されて、<br />初めて人は本気になる。
            </p>
          </RevealSection>
        </div>
      </section>

      {/* 3つのルール */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-sm">
          <RevealSection>
            <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">How it works</p>
            <h3 className="mt-3 text-center text-2xl font-black">3つのルール</h3>
          </RevealSection>
          <div className="mt-10 flex flex-col gap-6">
            {[
              { num: "1", title: "デポジットを賭けろ", color: "red", desc: <>最低<span className="font-bold text-red-400">3,000円</span>を与信枠として差し出す。<br />これがお前の覚悟の証明だ。サボらなければ1円も請求されない。</> },
              { num: "2", title: "毎日、証拠を出せ", color: "orange", desc: <>スクワッドに証拠写真を毎日投稿。<br />言い訳は不要。写真が全てを語る。<br /><span className="text-zinc-500">仲間がお前を見ている。</span></> },
              { num: "3", title: "サボれば、全滅", color: "zinc", desc: <>1人でも未提出なら、チーム全員のストリークが<span className="font-bold text-red-400">リセット</span>。<br />サボった本人のデポジットは<span className="font-bold text-red-400">即没収</span>。<br />連帯責任。逃げ場はない。</> },
            ].map((rule, i) => (
              <RevealSection key={rule.num} delay={(i + 1) * 100}>
                <div className={`relative overflow-hidden rounded-2xl border border-${rule.color}-900/40 bg-gradient-to-br from-${rule.color}-950/40 to-zinc-900 p-6`}>
                  <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-${rule.color}-500/10 blur-2xl" />
                  <div className="relative">
                    <div className="mb-3 flex items-center gap-3">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-full bg-${rule.color}-500/20 text-lg font-black text-${rule.color}-400`}>{rule.num}</span>
                      <h4 className="text-base font-black text-white">{rule.title}</h4>
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-400">{rule.desc}</p>
                  </div>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* フリーズ */}
      <section className="relative px-6 py-20">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zinc-950 via-cyan-950/5 to-zinc-950" />
        <div className="relative mx-auto max-w-sm">
          <RevealSection>
            <div className="rounded-2xl border border-cyan-900/40 bg-gradient-to-br from-cyan-950/30 to-zinc-900 p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-3xl">❄️</span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500/80">悪魔の救済措置</p>
                  <h4 className="text-lg font-black text-white">フリーズ</h4>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400">
                どうしてもサボりたい日がある？<br /><span className="font-bold text-cyan-400">500円</span>払えば、1日だけ処刑を回避できる。<br />ただし、チャレンジにつき<span className="font-bold text-white">1回限り</span>。
              </p>
              <div className="mt-4 rounded-xl border border-cyan-900/30 bg-cyan-950/20 px-4 py-3">
                <p className="text-xs text-zinc-500">
                  3,000円の没収 vs 500円のフリーズ。<br /><span className="text-cyan-400">賢い選択か、甘えか。それはお前が決めろ。</span>
                </p>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* 数字 */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-sm">
          <RevealSection>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "30", unit: "日間", label: "チャレンジ期間" },
                { value: "¥3,000", unit: "~", label: "デポジット" },
                { value: "24h", unit: "", label: "提出期限" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-5">
                  <span className="text-xl font-black text-red-400">{item.value}<span className="text-xs text-zinc-500">{item.unit}</span></span>
                  <span className="text-[10px] text-zinc-500">{item.label}</span>
                </div>
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-6 py-24">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 bottom-0 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-red-600/10 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-sm text-center">
          <RevealSection>
            <h3 className="text-3xl font-black leading-tight sm:text-4xl">
              本気で変わりたい<br /><span className="bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">奴だけ来い。</span>
            </h3>
            <p className="mt-4 text-sm text-zinc-500">楽な道はない。だからこそ、続いた時の価値がある。</p>
            <Link href="/login" className="mt-8 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 py-4 text-base font-black text-white shadow-xl shadow-red-500/25 transition-all hover:brightness-110 active:scale-[0.97]">
              今すぐ始める
            </Link>
            <p className="mt-3 text-xs text-zinc-600">無料アカウント作成 / ログイン</p>
          </RevealSection>
        </div>
      </section>

      <footer className="border-t border-zinc-800/60 px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg">🔥</span>
          <span className="text-sm font-bold text-zinc-500">Streak Squad</span>
        </div>
        <p className="mt-2 text-xs text-zinc-700">&copy; 2026 Streak Squad. All rights reserved.</p>
      </footer>
    </div>
  );
}

// ══════════════════════════════════════════════════
// ダッシュボード（ログイン済み）
// ══════════════════════════════════════════════════
const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  active: { label: "進行中", color: "text-red-400 border-red-500/30 bg-red-500/10", icon: "🔥" },
  completed: { label: "達成", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", icon: "✅" },
  failed: { label: "失敗", color: "text-zinc-400 border-zinc-500/30 bg-zinc-500/10", icon: "💀" },
  escaped: { label: "逃亡", color: "text-orange-400 border-orange-500/30 bg-orange-500/10", icon: "🏃" },
};

function Dashboard() {
  const { user, displayName, signOut } = useAuth();
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [challengeRes, workoutRes, profileRes] = await Promise.all([
      supabase
        .from("challenges")
        .select("id, task_description, deposit_amount, status, created_at, freeze_active")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("workouts")
        .select("id, image_url, user_name, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("xp")
        .eq("id", user.id)
        .single(),
    ]);
    setChallenges(challengeRes.data ?? []);
    setWorkouts(workoutRes.data ?? []);
    setXp(profileRes.data?.xp ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => { if (user) fetchData(); }, [user, fetchData]);

  useEffect(() => {
    if (displayName && workouts.length >= 0) {
      setStreak(calcStreakForUser(workouts, displayName));
    }
  }, [workouts, displayName]);

  const activeChallenge = challenges.find((c) => c.status === "active");
  const completedCount = challenges.filter((c) => c.status === "completed").length;
  const failedCount = challenges.filter((c) => c.status === "failed").length;
  const totalDeposit = challenges.reduce((sum, c) => sum + c.deposit_amount, 0);
  const confiscated = challenges.filter((c) => c.status === "failed").reduce((sum, c) => sum + c.deposit_amount, 0);

  const getDaysLeft = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    return Math.max(0, 30 - Math.floor(diff / 86400000));
  };

  const getDaysProgress = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    return Math.min(100, (Math.floor(diff / 86400000) / 30) * 100);
  };

  const monthlyStats = displayName ? getMonthlyStats(workouts, displayName) : null;
  const weeklyHeatmap = displayName ? getWeeklyHeatmap(workouts, displayName) : [];
  const submittedToday = displayName
    ? workouts.some((w) => w.user_name === displayName && toLocalDateStr(new Date(w.created_at)) === toLocalDateStr(new Date()))
    : false;

  const getAvatarColor = (name: string | null) => {
    if (!name) return "from-zinc-500 to-zinc-600";
    const colors = ["from-red-500 to-rose-600", "from-orange-500 to-red-600", "from-rose-500 to-pink-600", "from-red-600 to-orange-500"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  if (loading) {
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
            {displayName?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <span className="text-sm font-medium text-zinc-300">{displayName}</span>
          <span className="rounded-md bg-purple-500/20 border border-purple-500/30 px-1.5 py-0.5 text-[10px] font-black text-purple-400">
            Lv.{xpForNextLevel(xp).level}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-xl ${streak > 0 ? "drop-shadow-[0_0_6px_rgba(249,115,22,0.6)]" : "opacity-30"}`}>🔥</span>
          <span className={`text-lg font-bold tabular-nums ${streak > 0 ? "bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent" : "text-zinc-600"}`}>
            {streak}
          </span>
        </div>
        <button
          type="button"
          onClick={async () => { await signOut(); router.replace("/login"); }}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
        >
          ログアウト
        </button>
      </div>

      <div className="mt-4 w-full max-w-sm flex flex-col gap-5">
        {/* ── 今日のステータス ── */}
        <div className={`rounded-2xl border p-5 ${
          submittedToday
            ? "border-emerald-900/50 bg-gradient-to-br from-emerald-950/40 to-zinc-900"
            : "border-red-900/50 bg-gradient-to-br from-red-950/40 to-zinc-900"
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">今日のステータス</p>
              <p className={`mt-1 text-xl font-black ${submittedToday ? "text-emerald-400" : "text-red-400"}`}>
                {submittedToday ? "✅ 提出済み" : "⚠️ 未提出"}
              </p>
            </div>
            {!submittedToday && (
              <Link
                href="/squad"
                className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-red-900/30 transition-all hover:brightness-110 active:scale-95"
              >
                📸 提出する
              </Link>
            )}
          </div>
        </div>

        {/* ── XP & レベル ── */}
        {(() => {
          const info = xpForNextLevel(xp);
          const title = getLevelTitle(info.level);
          return (
            <div className="rounded-2xl border border-purple-900/50 bg-gradient-to-br from-purple-950/40 via-zinc-900/80 to-zinc-950 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/30">
                    <span className="text-lg font-black text-purple-400">Lv.{info.level}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-purple-400/80">{title}</p>
                    <p className="text-xl font-black text-white">{xp.toLocaleString()} <span className="text-sm text-zinc-500">XP</span></p>
                  </div>
                </div>
              </div>
              {info.progress < 100 && (
                <div>
                  <div className="h-2.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-600 to-violet-500 transition-all duration-500"
                      style={{ width: `${info.progress}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px] text-zinc-600">
                    <span>Lv.{info.level}</span>
                    <span>{xp - info.currentLevelXp} / {info.nextLevelXp - info.currentLevelXp} XP</span>
                    <span>Lv.{info.level + 1}</span>
                  </div>
                </div>
              )}
              {info.progress >= 100 && (
                <p className="text-center text-xs text-purple-400/60 font-bold">MAX LEVEL</p>
              )}
            </div>
          );
        })()}

        {/* ── ストリーク & 週間ヒートマップ ── */}
        <div className="rounded-2xl border border-orange-900/50 bg-gradient-to-br from-red-950/60 via-zinc-900/80 to-zinc-950 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-400/80">個人ストリーク</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className={`text-4xl font-black tabular-nums ${streak > 0 ? "bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent" : "text-zinc-600"}`}>
                  {streak}
                </span>
                <span className="text-sm font-bold text-orange-400/80">日連続</span>
              </div>
            </div>
            <span className={`text-5xl ${streak > 0 ? "drop-shadow-[0_0_16px_rgba(249,115,22,0.7)]" : "grayscale opacity-20"}`}>🔥</span>
          </div>

          {/* 週間ヒートマップ */}
          <div className="flex gap-1.5">
            {weeklyHeatmap.map((done, i) => {
              const dayIndex = (new Date().getDay() + 7 - (6 - i)) % 7;
              const label = DAY_LABELS[dayIndex === 0 ? 6 : dayIndex - 1];
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className={`h-8 w-full rounded-lg transition-all ${
                    done
                      ? "bg-gradient-to-t from-orange-600 to-amber-500 shadow-sm shadow-orange-500/30"
                      : "bg-zinc-800/60 border border-zinc-700/50"
                  }`} />
                  <span className="text-[9px] text-zinc-500">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── アクティブチャレンジ ── */}
        {activeChallenge ? (
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
            <p className="mb-3 text-sm font-bold leading-relaxed text-white">{activeChallenge.task_description}</p>

            {/* プログレスバー */}
            <div className="mb-3">
              <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-600 to-rose-500 transition-all duration-500"
                  style={{ width: `${getDaysProgress(activeChallenge.created_at)}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
                <span>0日</span>
                <span>30日</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-zinc-800/60 px-4 py-3">
              <span className="text-xs text-zinc-500">デポジット</span>
              <span className="text-lg font-black text-red-400">¥{activeChallenge.deposit_amount.toLocaleString()}</span>
            </div>

            {activeChallenge.freeze_active && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-cyan-900/30 bg-cyan-950/20 px-3 py-2">
                <span>❄️</span>
                <span className="text-xs font-bold text-cyan-400">フリーズ有効</span>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/challenges/new"
            className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-red-900/40 bg-red-950/10 py-6 text-sm font-black text-red-400 transition-all hover:bg-red-950/20 active:scale-[0.97]"
          >
            ⛓️ 新しいチャレンジを宣言する
          </Link>
        )}

        {/* ── 月間提出率 ── */}
        {monthlyStats && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
                📊 {new Date().getMonth() + 1}月の提出率
              </h3>
              <span className="text-2xl font-black text-white">
                {monthlyStats.today > 0 ? Math.round((monthlyStats.submittedCount / monthlyStats.today) * 100) : 0}
                <span className="text-sm text-zinc-500">%</span>
              </span>
            </div>

            {/* カレンダーグリッド */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: monthlyStats.daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = toLocalDateStr(new Date(new Date().getFullYear(), new Date().getMonth(), day));
                const submitted = monthlyStats.submittedDays.has(dateStr);
                const isFuture = day > monthlyStats.today;
                const isToday = day === monthlyStats.today;
                return (
                  <div
                    key={day}
                    className={`flex h-8 items-center justify-center rounded-md text-[10px] font-bold transition-all ${
                      isFuture
                        ? "text-zinc-700 bg-zinc-900/30"
                        : submitted
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : isToday
                        ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse"
                        : "bg-zinc-800/40 text-zinc-600"
                    }`}
                  >
                    {day}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-zinc-500">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/30" /> 提出済
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-zinc-800/40" /> 未提出
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-zinc-900/30" /> 未来
              </span>
            </div>
          </div>
        )}

        {/* ── 統計サマリー ── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "総チャレンジ", value: challenges.length, icon: "⛓️", sub: `達成 ${completedCount} / 失敗 ${failedCount}` },
            { label: "総デポジット", value: `¥${totalDeposit.toLocaleString()}`, icon: "💰", sub: confiscated > 0 ? `没収 ¥${confiscated.toLocaleString()}` : "没収なし" },
          ].map(({ label, value, icon, sub }) => (
            <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{icon}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
              </div>
              <span className="text-xl font-black text-white">{value}</span>
              <span className="text-[10px] text-zinc-600">{sub}</span>
            </div>
          ))}
        </div>

        {/* ── 戦績一覧 ── */}
        {challenges.length > 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/60">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">📜 戦績</h3>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {challenges.slice(0, 5).map((c) => {
                const s = STATUS_MAP[c.status] ?? { label: c.status, color: "text-zinc-400 border-zinc-700 bg-zinc-800", icon: "?" };
                return (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-lg">{s.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-300 truncate">{c.task_description}</p>
                      <p className="text-[10px] text-zinc-600">
                        {new Date(c.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
                        {" "}・ ¥{c.deposit_amount.toLocaleString()}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${s.color}`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {challenges.length > 5 && (
              <Link href="/profile" className="flex items-center justify-center py-3 text-xs text-zinc-500 hover:text-zinc-300 border-t border-zinc-800/50">
                すべての戦績を見る →
              </Link>
            )}
          </div>
        )}

        {/* スクワッドへ */}
        <Link
          href="/squad"
          className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900/60 py-4 text-sm font-semibold text-zinc-300 transition-all hover:border-zinc-500 hover:text-white active:scale-[0.97]"
        >
          👥 スクワッドのタイムラインへ
        </Link>
      </div>

      <footer className="mt-12 text-xs text-zinc-700">Streak Squad &copy; 2026</footer>
    </div>
  );
}

// ══════════════════════════════════════════════════
// メインコンポーネント
// ══════════════════════════════════════════════════
export default function Home() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="gradient-bg flex min-h-dvh items-center justify-center">
        <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
      </div>
    );
  }

  return user ? <Dashboard /> : <LandingPage />;
}
