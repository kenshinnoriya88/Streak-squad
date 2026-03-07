"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { MessageCircle, Send, Loader2 } from "lucide-react";

interface Comment {
    id: string;
    workout_id: string;
    user_name: string;
    body: string;
    created_at: string;
}

interface WorkoutCommentsProps {
    workoutId: string;
    currentUser: string;
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "たった今";
    if (mins < 60) return `${mins}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    return new Date(iso).toLocaleDateString("ja-JP", {
        month: "short",
        day: "numeric",
    });
}

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

export default function WorkoutComments({
    workoutId,
    currentUser,
}: WorkoutCommentsProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [body, setBody] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [commentCount, setCommentCount] = useState(0);
    const [sendError, setSendError] = useState<string | null>(null);

    // コメント件数だけ最初に取得
    useEffect(() => {
        (async () => {
            const { count, error } = await supabase
                .from("comments")
                .select("*", { count: "exact", head: true })
                .eq("workout_id", workoutId);
            if (!error) setCommentCount(count ?? 0);
        })();
    }, [workoutId]);

    // 開いたら全件取得
    const fetchComments = useCallback(async () => {
        const { data, error } = await supabase
            .from("comments")
            .select("*")
            .eq("workout_id", workoutId)
            .order("created_at", { ascending: true });
        if (error) {
            console.error("コメント取得エラー:", error);
            return;
        }
        const list = data ?? [];
        setComments(list);
        setCommentCount(list.length);
    }, [workoutId]);

    useEffect(() => {
        if (isOpen) fetchComments();
    }, [isOpen, fetchComments]);

    const handleSend = async () => {
        const trimmed = body.trim();
        if (!trimmed || isSending) return;
        setIsSending(true);
        setSendError(null);

        try {
            const { error } = await supabase.from("comments").insert({
                workout_id: workoutId,
                user_name: currentUser,
                body: trimmed,
            });
            if (error) {
                // RLSポリシーエラーの場合わかりやすく表示
                if (error.code === "42501" || error.message.includes("policy")) {
                    setSendError("権限エラー: Supabaseのcommentsテーブルに INSERT ポリシーが必要です");
                } else {
                    setSendError(`送信失敗: ${error.message}`);
                }
                console.error("コメント送信エラー:", error);
                return;
            }
            setBody("");
            await fetchComments();
        } catch (err) {
            const msg = err instanceof Error ? err.message : "不明なエラー";
            setSendError(`送信失敗: ${msg}`);
            console.error("コメント送信エラー:", err);
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="border-t border-zinc-800/60">
            {/* トグルボタン */}
            <button
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-zinc-800/30"
            >
                <MessageCircle
                    size={15}
                    className={`transition-colors ${isOpen ? "text-indigo-400" : "text-zinc-500"}`}
                />
                <span
                    className={`text-xs font-medium ${isOpen ? "text-indigo-400" : "text-zinc-500"}`}
                >
                    {commentCount > 0
                        ? `💬 コメント (${commentCount}件)`
                        : "💬 コメントする"}
                </span>
                <svg
                    className={`ml-auto h-3 w-3 text-zinc-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* コメントエリア */}
            {isOpen && (
                <div className="animate-in slide-in-from-top-2 border-t border-zinc-800/40 bg-zinc-950/40 px-4 py-3">
                    {/* コメント一覧 */}
                    {comments.length > 0 && (
                        <div className="mb-3 flex flex-col gap-2.5">
                            {comments.map((c) => {
                                const isMe = c.user_name === currentUser;
                                return (
                                    <div
                                        key={c.id}
                                        className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}
                                    >
                                        {/* アバター */}
                                        <div
                                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(c.user_name)} text-[10px] font-bold text-white`}
                                        >
                                            {c.user_name.charAt(0).toUpperCase()}
                                        </div>
                                        {/* 吹き出し */}
                                        <div
                                            className={`max-w-[75%] rounded-2xl px-3 py-2 ${isMe
                                                ? "rounded-tr-sm bg-indigo-500/20 text-indigo-100"
                                                : "rounded-tl-sm bg-zinc-800/80 text-zinc-200"
                                                }`}
                                        >
                                            {!isMe && (
                                                <p className="mb-0.5 text-[10px] font-semibold text-zinc-400">
                                                    {c.user_name}
                                                </p>
                                            )}
                                            <p className="text-sm leading-relaxed">{c.body}</p>
                                            <p
                                                className={`mt-0.5 text-[10px] ${isMe ? "text-indigo-400/50" : "text-zinc-600"}`}
                                            >
                                                {timeAgo(c.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* エラー表示 */}
                    {sendError && (
                        <p className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400">
                            ❌ {sendError}
                        </p>
                    )}

                    {/* 入力エリア */}
                    <div className="flex items-center gap-2">
                        <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(currentUser)} text-[10px] font-bold text-white`}
                        >
                            {currentUser.charAt(0).toUpperCase()}
                        </div>
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="ナイス筋トレ！💪"
                                className="w-full rounded-full border border-zinc-700 bg-zinc-800/60 py-2 pl-4 pr-10 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
                            />
                            <button
                                type="button"
                                onClick={handleSend}
                                disabled={!body.trim() || isSending}
                                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-indigo-500 text-white transition-all hover:bg-indigo-400 active:scale-90 disabled:bg-zinc-700 disabled:text-zinc-500"
                            >
                                {isSending ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Send size={14} />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
