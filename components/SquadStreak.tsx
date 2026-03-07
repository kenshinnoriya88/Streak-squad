"use client";

import { useMemo } from "react";

interface Workout {
    id: string;
    image_url: string;
    user_name: string | null;
    created_at: string;
}

interface SquadStreakProps {
    workouts: Workout[];
}

// ── JST日付キー生成 ──
function toJstDayKey(iso: string): string {
    const d = new Date(iso);
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

function jstToday(): string {
    return toJstDayKey(new Date().toISOString());
}

function jstDayOffset(offset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return toJstDayKey(d.toISOString());
}

export default function SquadStreak({ workouts }: SquadStreakProps) {
    const { squadStreak, totalMembers, todayDone, todayNames, missingNames } =
        useMemo(() => {
            // ユニークメンバー集計
            const memberSet = new Set<string>();
            workouts.forEach((w) => {
                if (w.user_name) memberSet.add(w.user_name);
            });
            const members = Array.from(memberSet);
            const total = members.length;
            if (total === 0)
                return {
                    squadStreak: 0,
                    totalMembers: 0,
                    todayDone: 0,
                    todayNames: [] as string[],
                    missingNames: [] as string[],
                };

            // 各メンバーが投稿した日のセットを構築
            const memberDays = new Map<string, Set<string>>();
            members.forEach((m) => memberDays.set(m, new Set()));
            workouts.forEach((w) => {
                if (w.user_name) {
                    memberDays.get(w.user_name)!.add(toJstDayKey(w.created_at));
                }
            });

            // 今日の完了状況
            const todayKey = jstToday();
            const doneToday: string[] = [];
            const notDoneToday: string[] = [];
            members.forEach((m) => {
                if (memberDays.get(m)!.has(todayKey)) {
                    doneToday.push(m);
                } else {
                    notDoneToday.push(m);
                }
            });

            // 昨日から遡ってチーム全員が投稿した連続日数を計算
            let streak = 0;
            let dayOffset = -1; // 昨日から開始
            while (true) {
                const dayKey = jstDayOffset(dayOffset);
                const allPosted = members.every((m) =>
                    memberDays.get(m)!.has(dayKey),
                );
                if (allPosted) {
                    streak++;
                    dayOffset--;
                } else {
                    break;
                }
            }

            // 今日も全員完了なら +1
            if (doneToday.length === total) {
                streak++;
            }

            return {
                squadStreak: streak,
                totalMembers: total,
                todayDone: doneToday.length,
                todayNames: doneToday,
                missingNames: notDoneToday,
            };
        }, [workouts]);

    const allDoneToday = todayDone === totalMembers && totalMembers > 0;
    const progressPct =
        totalMembers > 0 ? (todayDone / totalMembers) * 100 : 0;

    if (totalMembers === 0) {
        return (
            <div className="w-full max-w-sm rounded-2xl border border-dashed border-zinc-700 px-6 py-8 text-center">
                <span className="text-3xl">👥</span>
                <p className="mt-2 text-sm text-zinc-400">
                    メンバーがまだいません
                </p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-sm">
            {/* メインカード */}
            <div
                className={`overflow-hidden rounded-2xl border transition-all duration-500 ${allDoneToday
                        ? "border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-yellow-500/10 shadow-lg shadow-amber-500/10"
                        : "border-zinc-700/50 bg-zinc-900/60"
                    }`}
            >
                {/* ヘッダー */}
                <div className="px-5 pt-5 pb-3">
                    <h3
                        className={`text-xs font-bold tracking-widest uppercase ${allDoneToday ? "text-amber-400" : "text-zinc-500"
                            }`}
                    >
                        🔥 SQUAD STREAK
                    </h3>
                    <p
                        className={`text-[10px] ${allDoneToday ? "text-amber-400/60" : "text-zinc-600"}`}
                    >
                        チーム連帯記録
                    </p>
                </div>

                {/* ストリーク数字 */}
                <div className="flex items-end justify-center gap-2 px-5 pb-4">
                    <span
                        className={`text-6xl font-black tabular-nums leading-none transition-all duration-500 ${allDoneToday
                                ? "bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(251,191,36,0.3)]"
                                : squadStreak > 0
                                    ? "bg-gradient-to-r from-zinc-300 to-zinc-400 bg-clip-text text-transparent"
                                    : "text-zinc-700"
                            }`}
                    >
                        {squadStreak}
                    </span>
                    <span
                        className={`mb-1 text-lg font-bold ${allDoneToday ? "text-amber-400/80" : "text-zinc-600"}`}
                    >
                        日
                    </span>
                </div>

                {/* プログレスバー */}
                <div className="px-5 pb-4">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-400">
                            今日のミッション
                        </span>
                        <span
                            className={`text-xs font-bold tabular-nums ${allDoneToday ? "text-emerald-400" : "text-amber-400"
                                }`}
                        >
                            {todayDone} / {totalMembers} 人 完了
                        </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${allDoneToday
                                    ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/40"
                                    : "bg-gradient-to-r from-amber-500 to-orange-500 shadow-sm shadow-amber-500/40"
                                }`}
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>

                {/* 未完了メンバー */}
                {missingNames.length > 0 && (
                    <div className="border-t border-zinc-800/60 px-5 py-3">
                        <p className="mb-2 text-[10px] font-semibold tracking-wider text-red-400/80 uppercase">
                            ⚠️ 未完了メンバー
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {missingNames.map((name) => (
                                <span
                                    key={name}
                                    className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400"
                                >
                                    {name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* 全員完了メッセージ */}
                {allDoneToday && (
                    <div className="border-t border-amber-500/20 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 px-5 py-3 text-center">
                        <p className="text-sm font-bold text-emerald-400">
                            ✨ 全員ミッション完了！連帯記録継続中！
                        </p>
                    </div>
                )}

                {/* 警告テキスト */}
                <div className="border-t border-zinc-800/40 px-5 py-2.5">
                    <p className="text-center text-[10px] text-zinc-600">
                        ※ 誰か一人でもサボるとチームの記録がゼロになります
                    </p>
                </div>
            </div>
        </div>
    );
}
