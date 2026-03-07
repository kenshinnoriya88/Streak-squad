"use client";

import { useMemo } from "react";
import confetti from "canvas-confetti";

// ── 型 ──
interface Workout {
    id: string;
    image_url: string;
    user_name: string | null;
    created_at: string;
}

interface PersonalStreakProps {
    workouts: Workout[];
    displayName: string;
    streak: number;
}

// ── JST日付キー生成 ──
function toJstDayKey(iso: string): string {
    const d = new Date(iso);
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

// ── ストリーク計算 ──
export function calcStreakForUser(
    workouts: Workout[],
    userName: string,
): number {
    const myWorkouts = workouts.filter((w) => w.user_name === userName);
    if (myWorkouts.length === 0) return 0;

    const postedDays = new Set<string>();
    myWorkouts.forEach((w) => postedDays.add(toJstDayKey(w.created_at)));

    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const todayKey = toJstDayKey(now.toISOString());

    let checkDate: Date;
    if (postedDays.has(todayKey)) {
        checkDate = new Date(jstNow);
    } else {
        checkDate = new Date(jstNow);
        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
        const yesterdayKey = `${checkDate.getUTCFullYear()}-${String(checkDate.getUTCMonth() + 1).padStart(2, "0")}-${String(checkDate.getUTCDate()).padStart(2, "0")}`;
        if (!postedDays.has(yesterdayKey)) return 0;
    }

    let count = 0;
    while (true) {
        const key = `${checkDate.getUTCFullYear()}-${String(checkDate.getUTCMonth() + 1).padStart(2, "0")}-${String(checkDate.getUTCDate()).padStart(2, "0")}`;
        if (postedDays.has(key)) {
            count++;
            checkDate.setUTCDate(checkDate.getUTCDate() - 1);
        } else {
            break;
        }
    }
    return count;
}

// ── 紙吹雪 ──
export function fireConfetti() {
    const duration = 3000;
    const end = Date.now() + duration;
    const colors = [
        "#6366f1",
        "#a855f7",
        "#ec4899",
        "#f59e0b",
        "#10b981",
        "#06b6d4",
    ];

    const frame = () => {
        confetti({
            particleCount: 4,
            angle: 60,
            spread: 70,
            origin: { x: 0, y: 0.6 },
            colors,
            zIndex: 9999,
        });
        confetti({
            particleCount: 4,
            angle: 120,
            spread: 70,
            origin: { x: 1, y: 0.6 },
            colors,
            zIndex: 9999,
        });
        if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();

    setTimeout(() => {
        confetti({
            particleCount: 150,
            spread: 100,
            origin: { x: 0.5, y: 0.4 },
            colors,
            zIndex: 9999,
            scalar: 1.2,
        });
    }, 300);
}

// ── ストリークメッセージ ──
function getStreakMessage(s: number): string {
    if (s >= 30) return "伝説級 🏆";
    if (s >= 14) return "神モード ⚡";
    if (s >= 7) return "絶好調！ 🚀";
    if (s >= 3) return "いい感じ！ 💪";
    if (s >= 1) return "スタート！ 🌱";
    return "今日から始めよう";
}

// ── コンポーネント ──
export default function PersonalStreak({
    workouts,
    displayName,
    streak,
}: PersonalStreakProps) {
    // 直近7日のドットデータを生成
    const weekDots = useMemo(() => {
        const myWorkouts = workouts.filter((w) => w.user_name === displayName);
        const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];

        return [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const dayKey = toJstDayKey(d.toISOString());
            const hasDone = myWorkouts.some(
                (w) => toJstDayKey(w.created_at) === dayKey,
            );
            return { label: dayLabels[d.getDay()], hasDone };
        });
    }, [workouts, displayName]);

    return (
        <div className="w-full max-w-sm">
            <div
                className={`flex items-center justify-between rounded-2xl border px-5 py-4 transition-all duration-500 ${streak > 0
                        ? "border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-amber-500/10 shadow-lg shadow-orange-500/5"
                        : "border-zinc-800 bg-zinc-900/40"
                    }`}
            >
                {/* 左: 🔥 + 数字 + メッセージ */}
                <div className="flex items-center gap-3">
                    <span
                        className={`text-3xl transition-all duration-500 ${streak > 0
                                ? "animate-bounce drop-shadow-[0_0_12px_rgba(249,115,22,0.5)]"
                                : "grayscale opacity-40"
                            }`}
                    >
                        🔥
                    </span>
                    <div className="flex flex-col">
                        <span
                            className={`text-2xl font-black tabular-nums leading-none ${streak > 0
                                    ? "bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent"
                                    : "text-zinc-600"
                                }`}
                        >
                            {streak}日
                        </span>
                        <span
                            className={`text-xs font-medium ${streak > 0 ? "text-orange-400/80" : "text-zinc-600"}`}
                        >
                            {getStreakMessage(streak)}
                        </span>
                    </div>
                </div>

                {/* 右: 7日間ドット */}
                <div className="flex gap-1">
                    {weekDots.map((dot, i) => (
                        <div key={i} className="flex flex-col items-center gap-0.5">
                            <span className="text-[9px] text-zinc-600">{dot.label}</span>
                            <div
                                className={`h-5 w-5 rounded-full transition-all duration-300 ${dot.hasDone
                                        ? "bg-gradient-to-br from-orange-400 to-amber-500 shadow-sm shadow-orange-400/40"
                                        : "border border-zinc-700 bg-zinc-800/50"
                                    }`}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
