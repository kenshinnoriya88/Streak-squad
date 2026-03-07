"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            const params = new URLSearchParams(window.location.search);
            const code = params.get("code");

            if (code) {
                // PKCE フロー: code をセッションに交換
                const { error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) {
                    console.error("セッション確立エラー:", error);
                    setError(error.message);
                    return;
                }
            }

            // ハッシュフラグメント(#access_token=...)の場合は
            // onAuthStateChange が自動的にセッションを検出する
            // 少し待ってからリダイレクト
            await new Promise((r) => setTimeout(r, 500));
            router.replace("/");
        };

        handleCallback();
    }, [router]);

    if (error) {
        return (
            <div className="gradient-bg flex min-h-dvh flex-col items-center justify-center px-6">
                <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20 text-3xl">
                        ❌
                    </div>
                    <h1 className="text-xl font-bold text-white">認証エラー</h1>
                    <p className="text-sm text-zinc-400">{error}</p>
                    <button
                        type="button"
                        onClick={() => router.replace("/login")}
                        className="rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-400"
                    >
                        ログイン画面に戻る
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="gradient-bg flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
            <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
            <p className="text-sm text-zinc-400">認証を確認中...</p>
        </div>
    );
}
