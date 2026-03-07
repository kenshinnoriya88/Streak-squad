"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import {
    X,
    User,
    Calendar,
    Ruler,
    Dumbbell,
    Save,
    Loader2,
    CheckCircle2,
} from "lucide-react";

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface FormData {
    displayName: string;
    dateOfBirth: string;
    height: string;
    benchPressMax: string;
    squatMax: string;
    deadliftMax: string;
}

function calcAge(dob: string): number | null {
    if (!dob) return null;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
    const { user } = useAuth();
    const [form, setForm] = useState<FormData>({
        displayName: "",
        dateOfBirth: "",
        height: "",
        benchPressMax: "",
        squatMax: "",
        deadliftMax: "",
    });
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // user_metadata から初期値を読み込み
    useEffect(() => {
        if (!user) return;
        const meta = user.user_metadata ?? {};
        setForm({
            displayName: meta.display_name ?? "",
            dateOfBirth: meta.dob ?? "",
            height: meta.height?.toString() ?? "",
            benchPressMax: meta.bench_max?.toString() ?? "",
            squatMax: meta.squat_max?.toString() ?? "",
            deadliftMax: meta.deadlift_max?.toString() ?? "",
        });
    }, [user]);

    const age = useMemo(() => calcAge(form.dateOfBirth), [form.dateOfBirth]);

    const big3Total = useMemo(() => {
        const b = parseFloat(form.benchPressMax) || 0;
        const s = parseFloat(form.squatMax) || 0;
        const d = parseFloat(form.deadliftMax) || 0;
        return b + s + d;
    }, [form.benchPressMax, form.squatMax, form.deadliftMax]);

    const handleChange = useCallback(
        (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
            setForm((prev) => ({ ...prev, [field]: e.target.value }));
            setSaved(false);
            setError(null);
        },
        [],
    );

    const handleSave = async () => {
        if (!form.displayName.trim()) {
            setError("表示名を入力してください");
            return;
        }
        setIsSaving(true);
        setError(null);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                data: {
                    display_name: form.displayName.trim(),
                    dob: form.dateOfBirth || null,
                    height: form.height ? parseFloat(form.height) : null,
                    bench_max: form.benchPressMax
                        ? parseFloat(form.benchPressMax)
                        : null,
                    squat_max: form.squatMax ? parseFloat(form.squatMax) : null,
                    deadlift_max: form.deadliftMax
                        ? parseFloat(form.deadliftMax)
                        : null,
                },
            });

            if (updateError) throw updateError;
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "保存に失敗しました";
            setError(msg);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center"
            onClick={onClose}
        >
            {/* 背景 */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* モーダル本体 */}
            <div
                className="celebration-pop relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-zinc-700/50 bg-zinc-900/95 shadow-2xl backdrop-blur-xl sm:rounded-3xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── ヘッダー ── */}
                <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600">
                            <User size={16} className="text-white" />
                        </div>
                        <h2 className="text-lg font-bold text-white">プロフィール設定</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-all hover:bg-zinc-700 hover:text-white"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* ── フォーム ── */}
                <div className="max-h-[70dvh] overflow-y-auto px-6 py-5">
                    {/* === 基本情報セクション === */}
                    <div className="mb-6">
                        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                            <User size={14} /> 基本情報
                        </h3>
                        <div className="flex flex-col gap-4">
                            {/* 表示名 */}
                            <div>
                                <label
                                    htmlFor="prof-name"
                                    className="mb-1 block text-sm font-medium text-zinc-300"
                                >
                                    表示名
                                </label>
                                <div className="relative">
                                    <User
                                        size={16}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                                    />
                                    <input
                                        id="prof-name"
                                        type="text"
                                        value={form.displayName}
                                        onChange={handleChange("displayName")}
                                        placeholder="筋トレ太郎"
                                        className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
                                    />
                                </div>
                            </div>

                            {/* 生年月日 + 年齢 */}
                            <div>
                                <label
                                    htmlFor="prof-dob"
                                    className="mb-1 block text-sm font-medium text-zinc-300"
                                >
                                    生年月日
                                </label>
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1">
                                        <Calendar
                                            size={16}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                                        />
                                        <input
                                            id="prof-dob"
                                            type="date"
                                            value={form.dateOfBirth}
                                            onChange={handleChange("dateOfBirth")}
                                            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 [color-scheme:dark]"
                                        />
                                    </div>
                                    {age !== null && (
                                        <span className="shrink-0 rounded-lg bg-indigo-500/15 px-3 py-2 text-sm font-bold text-indigo-400">
                                            {age}歳
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* 身長 */}
                            <div>
                                <label
                                    htmlFor="prof-height"
                                    className="mb-1 block text-sm font-medium text-zinc-300"
                                >
                                    身長
                                </label>
                                <div className="relative">
                                    <Ruler
                                        size={16}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                                    />
                                    <input
                                        id="prof-height"
                                        type="number"
                                        inputMode="decimal"
                                        value={form.height}
                                        onChange={handleChange("height")}
                                        placeholder="170"
                                        className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 pl-10 pr-12 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500">
                                        cm
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* === BIG3 セクション === */}
                    <div>
                        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                            <Dumbbell size={14} /> BIG3 MAX重量
                        </h3>
                        <div className="flex flex-col gap-4">
                            {/* ベンチプレス */}
                            <div>
                                <label
                                    htmlFor="prof-bench"
                                    className="mb-1 block text-sm font-medium text-zinc-300"
                                >
                                    🏋️ ベンチプレス
                                </label>
                                <div className="relative">
                                    <input
                                        id="prof-bench"
                                        type="number"
                                        inputMode="decimal"
                                        value={form.benchPressMax}
                                        onChange={handleChange("benchPressMax")}
                                        placeholder="80"
                                        className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 pl-4 pr-12 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500">
                                        kg
                                    </span>
                                </div>
                            </div>

                            {/* スクワット */}
                            <div>
                                <label
                                    htmlFor="prof-squat"
                                    className="mb-1 block text-sm font-medium text-zinc-300"
                                >
                                    🦵 スクワット
                                </label>
                                <div className="relative">
                                    <input
                                        id="prof-squat"
                                        type="number"
                                        inputMode="decimal"
                                        value={form.squatMax}
                                        onChange={handleChange("squatMax")}
                                        placeholder="120"
                                        className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 pl-4 pr-12 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500">
                                        kg
                                    </span>
                                </div>
                            </div>

                            {/* デッドリフト */}
                            <div>
                                <label
                                    htmlFor="prof-dead"
                                    className="mb-1 block text-sm font-medium text-zinc-300"
                                >
                                    💀 デッドリフト
                                </label>
                                <div className="relative">
                                    <input
                                        id="prof-dead"
                                        type="number"
                                        inputMode="decimal"
                                        value={form.deadliftMax}
                                        onChange={handleChange("deadliftMax")}
                                        placeholder="140"
                                        className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 pl-4 pr-12 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500">
                                        kg
                                    </span>
                                </div>
                            </div>

                            {/* BIG3 合計 */}
                            {big3Total > 0 && (
                                <div className="flex items-center justify-between rounded-xl border border-zinc-700/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-4 py-3">
                                    <span className="text-sm font-medium text-zinc-300">
                                        BIG3 合計
                                    </span>
                                    <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-xl font-black tabular-nums text-transparent">
                                        {big3Total}
                                        <span className="ml-1 text-sm font-bold text-amber-400/70">
                                            kg
                                        </span>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── フッター（エラー + 保存ボタン） ── */}
                <div className="border-t border-zinc-800 px-6 py-4">
                    {error && (
                        <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm font-medium text-red-400">
                            ❌ {error}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-base font-bold transition-all active:scale-[0.97] disabled:pointer-events-none ${saved
                                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                                : "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:brightness-110"
                            }`}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                保存中...
                            </>
                        ) : saved ? (
                            <>
                                <CheckCircle2 size={18} />
                                保存しました！
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                プロフィールを保存
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
