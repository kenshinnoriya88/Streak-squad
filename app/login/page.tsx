"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { useEffect } from "react";

type Mode = "login" | "signup";

export default function LoginPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [mode, setMode] = useState<Mode>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    // ログイン済みならトップへ
    useEffect(() => {
        if (!loading && user) {
            router.replace("/");
        }
    }, [user, loading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
            if (mode === "signup") {
                // ── 新規登録 ──
                if (!displayName.trim()) {
                    setError("表示名を入力してください");
                    setIsSubmitting(false);
                    return;
                }

                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            display_name: displayName.trim(),
                        },
                        emailRedirectTo: `${window.location.origin}/auth/callback`,
                    },
                });

                if (error) throw error;
                setEmailSent(true);
            } else {
                // ── ログイン ──
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) throw error;
                router.replace("/");
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "不明なエラー";
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ローディング中
    if (loading) {
        return (
            <div className="gradient-bg flex min-h-dvh items-center justify-center">
                <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
            </div>
        );
    }

    // 確認メール送信済み
    if (emailSent) {
        return (
            <div className="gradient-bg flex min-h-dvh flex-col items-center justify-center px-6">
                <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-4xl shadow-lg shadow-emerald-500/30">
                        ✉️
                    </div>
                    <h1 className="text-2xl font-bold text-white">確認メールを送信しました</h1>
                    <p className="text-base leading-relaxed text-zinc-400">
                        <span className="font-medium text-white">{email}</span> に確認メールを送りました。
                        <br />
                        メール内のリンクをクリックして登録を完了してください。
                    </p>
                    <div className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                        💡 メールが届かない場合は、迷惑メールフォルダもご確認ください
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setEmailSent(false);
                            setMode("login");
                        }}
                        className="mt-2 text-sm font-medium text-indigo-400 transition-colors hover:text-indigo-300"
                    >
                        ← ログイン画面に戻る
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="gradient-bg flex min-h-dvh flex-col items-center justify-center px-6">
            <div className="flex w-full max-w-sm flex-col items-center gap-8">
                {/* ロゴ */}
                <div className="flex flex-col items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-3xl shadow-lg shadow-indigo-500/30">
                        💪
                    </div>
                    <h1 className="text-2xl font-bold text-white">Streak Squad</h1>
                    <p className="text-sm text-zinc-500">連帯責任筋トレアプリ</p>
                </div>

                {/* タブ切り替え */}
                <div className="flex w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
                    <button
                        type="button"
                        onClick={() => { setMode("login"); setError(""); }}
                        className={`flex-1 py-3 text-sm font-semibold transition-all ${mode === "login"
                                ? "bg-indigo-500/20 text-indigo-400"
                                : "text-zinc-500 hover:text-zinc-300"
                            }`}
                    >
                        ログイン
                    </button>
                    <button
                        type="button"
                        onClick={() => { setMode("signup"); setError(""); }}
                        className={`flex-1 py-3 text-sm font-semibold transition-all ${mode === "signup"
                                ? "bg-indigo-500/20 text-indigo-400"
                                : "text-zinc-500 hover:text-zinc-300"
                            }`}
                    >
                        新規登録
                    </button>
                </div>

                {/* フォーム */}
                <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
                    {mode === "signup" && (
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="displayName" className="text-xs font-medium text-zinc-400">
                                表示名
                            </label>
                            <div className="relative">
                                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base">
                                    👤
                                </span>
                                <input
                                    id="displayName"
                                    type="text"
                                    placeholder="筋トレ太郎"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    maxLength={20}
                                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="email" className="text-xs font-medium text-zinc-400">
                            メールアドレス
                        </label>
                        <div className="relative">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base">
                                ✉️
                            </span>
                            <input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="password" className="text-xs font-medium text-zinc-400">
                            パスワード
                        </label>
                        <div className="relative">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base">
                                🔒
                            </span>
                            <input
                                id="password"
                                type="password"
                                placeholder="6文字以上"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                            ❌ {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn-glow mt-2 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-3.5 text-base font-semibold text-white shadow-xl shadow-indigo-500/25 transition-all duration-300 hover:shadow-indigo-500/40 hover:brightness-110 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-70"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                処理中...
                            </span>
                        ) : mode === "signup" ? (
                            "🚀 アカウントを作成"
                        ) : (
                            "🔑 ログイン"
                        )}
                    </button>
                </form>

                <footer className="text-xs text-zinc-600">
                    Streak Squad &copy; 2026
                </footer>
            </div>
        </div>
    );
}
