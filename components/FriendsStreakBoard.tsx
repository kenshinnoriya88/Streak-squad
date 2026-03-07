"use client";

import { useMemo } from "react";
import { calcStreakForUser } from "./PersonalStreak";

interface Workout {
    id: string;
    image_url: string;
    user_name: string | null;
    created_at: string;
}

interface FriendsStreakBoardProps {
    workouts: Workout[];
}

// ── JST日付キー生成 ──
function toJstDayKey(iso: string): string {
    const d = new Date(iso);
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

// ── アバター色 ──
function getAvatarColor(name: string): string {
    const colors = [
        "from-indigo-500 to-purple-600",
        "from-rose-500 to-pink-600",
        "from-amber-500 to-orange-600",
        "from-emerald-500 to-teal-600",
        "from-cyan-500 to-blue-600",
        "from-fuchsia-500 to-violet-600",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++)
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

// ── メンバー情報 ──
interface MemberInfo {
    name: string;
    streak: number;
    doneToday: boolean;
    lastActive: string;
}

export default function FriendsStreakBoard({
    workouts,
}: FriendsStreakBoardProps) {
    const todayKey = useMemo(() => toJstDayKey(new Date().toISOString()), []);

    const members: MemberInfo[] = useMemo(() => {
        // ユニークなユーザー名を収集
        const nameSet = new Set<string>();
        workouts.forEach((w) => {
            if (w.user_name) nameSet.add(w.user_name);
        });

        return Array.from(nameSet)
            .map((name) => {
                const userWorkouts = workouts.filter((w) => w.user_name === name);
                const streak = calcStreakForUser(workouts, name);
                const doneToday = userWorkouts.some(
                    (w) => toJstDayKey(w.created_at) === todayKey,
                );
                // 最新の投稿日時
                const lastActive =
                    userWorkouts.length > 0 ? userWorkouts[0].created_at : "";
                return { name, streak, doneToday, lastActive };
            })
            .sort((a, b) => {
                // 未完了(false)を上に、完了(true)を下に
                if (a.doneToday !== b.doneToday) {
                    return a.doneToday ? 1 : -1;
                }
                // 同じステータスならストリークの降順
                return b.streak - a.streak;
            });
    }, [workouts, todayKey]);

    if (members.length === 0) {
        return null;
    }

    return (
        <div className="w-full max-w-sm">
            {/* セクションヘッダー */}
            <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                <h2 className="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
                    👥 メンバー状況
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
            </div>

            {/* メンバーリスト */}
            <div className="flex flex-col gap-2">
                {members.map((m, i) => (
                    <div
                        key={m.name}
                        className={`timeline-card flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-300 ${m.doneToday
                            ? "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40"
                            : "border-red-500/20 bg-red-500/5 hover:border-red-500/30"
                            }`}
                        style={{ animationDelay: `${i * 60}ms` }}
                    >
                        {/* アバター */}
                        <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(m.name)} text-sm font-bold text-white shadow-sm ${!m.doneToday ? "opacity-50 grayscale" : ""
                                }`}
                        >
                            {m.name.charAt(0).toUpperCase()}
                        </div>

                        {/* 名前 + ステータス */}
                        <div className="flex flex-1 flex-col">
                            <span
                                className={`text-sm font-semibold ${m.doneToday ? "text-white" : "text-zinc-500"}`}
                            >
                                {m.name}
                            </span>
                            <span
                                className={`text-xs font-medium ${m.doneToday ? "text-emerald-400" : "text-red-400/80"
                                    }`}
                            >
                                {m.doneToday ? "✅ 今日完了！" : "⚠️ 未完了"}
                            </span>
                        </div>

                        {/* ストリーク */}
                        <div className="flex items-center gap-1">
                            <span
                                className={`text-base transition-all ${m.streak > 0
                                    ? "drop-shadow-[0_0_4px_rgba(249,115,22,0.5)]"
                                    : "grayscale opacity-40"
                                    }`}
                            >
                                🔥
                            </span>
                            <span
                                className={`text-lg font-black tabular-nums ${m.streak > 0
                                    ? "bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent"
                                    : "text-zinc-600"
                                    }`}
                            >
                                {m.streak}
                            </span>
                        </div>

                        {/* ランキングバッジ（上位3位） */}
                        {i < 3 && m.streak > 0 && (
                            <span className="text-sm">
                                {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
