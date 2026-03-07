"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Bell, X, Loader2 } from "lucide-react";

interface Notification {
    id: string;
    recipient_name: string;
    actor_name: string;
    type: string;
    is_read: boolean;
    created_at: string;
}

interface NotificationBellProps {
    currentUserDisplayName: string;
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (mins < 1) return "たった今";
    if (mins < 60) return `${mins}分前`;
    if (hours < 24) return `${hours}時間前`;
    return new Date(iso).toLocaleDateString("ja-JP", {
        month: "short",
        day: "numeric",
    });
}

export default function NotificationBell({
    currentUserDisplayName,
}: NotificationBellProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [markingId, setMarkingId] = useState<string | null>(null);

    const fetchNotifications = useCallback(async () => {
        if (!currentUserDisplayName) return;
        const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("recipient_name", currentUserDisplayName)
            .eq("is_read", false)
            .order("created_at", { ascending: false })
            .limit(20);

        if (error) {
            console.error("通知取得エラー:", error);
            return;
        }
        const list = data ?? [];
        setNotifications(list);
        setUnreadCount(list.length);
    }, [currentUserDisplayName]);

    // マウント時 + 30秒ポーリング
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    const markAsRead = async (id: string) => {
        setMarkingId(id);
        try {
            await supabase
                .from("notifications")
                .update({ is_read: true })
                .eq("id", id);
            setNotifications((prev) => prev.filter((n) => n.id !== id));
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch (err) {
            console.error("既読更新エラー:", err);
        } finally {
            setMarkingId(null);
        }
    };

    const markAllRead = async () => {
        try {
            await supabase
                .from("notifications")
                .update({ is_read: true })
                .eq("recipient_name", currentUserDisplayName)
                .eq("is_read", false);
            setNotifications([]);
            setUnreadCount(0);
        } catch (err) {
            console.error("一括既読エラー:", err);
        }
    };

    const getMessage = (n: Notification) => {
        if (n.type === "poke") {
            return (
                <>
                    <span className="font-bold text-amber-400">{n.actor_name}</span>
                    <span className="text-zinc-300">
                        さんがあなたの筋トレを待っています！
                    </span>
                    <span className="text-red-400 font-bold"> サボるな！</span>
                </>
            );
        }
        return (
            <span className="text-zinc-300">
                {n.actor_name}さんからの通知があります
            </span>
        );
    };

    return (
        <div className="relative">
            {/* ベルアイコン */}
            <button
                type="button"
                onClick={() => {
                    setIsOpen((v) => !v);
                    if (!isOpen) fetchNotifications();
                }}
                className="relative flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-zinc-800 active:scale-90"
            >
                <Bell
                    size={18}
                    className={`transition-colors ${unreadCount > 0 ? "text-amber-400" : "text-zinc-500"}`}
                />
                {/* 未読バッジ */}
                {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm shadow-red-500/50">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* ドロップダウン */}
            {isOpen && (
                <>
                    {/* 背景オーバーレイ */}
                    <div
                        className="fixed inset-0 z-[100]"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 top-full z-[101] mt-2 w-72 overflow-hidden rounded-2xl border border-zinc-700/50 bg-zinc-900/95 shadow-2xl backdrop-blur-xl">
                        {/* ヘッダー */}
                        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                            <h3 className="text-sm font-bold text-white">🔔 お知らせ</h3>
                            <div className="flex items-center gap-2">
                                {notifications.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={markAllRead}
                                        className="text-[10px] font-medium text-indigo-400 hover:text-indigo-300"
                                    >
                                        全て既読
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-zinc-800"
                                >
                                    <X size={14} className="text-zinc-500" />
                                </button>
                            </div>
                        </div>

                        {/* 通知リスト */}
                        <div className="max-h-64 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 px-4 py-8">
                                    <span className="text-2xl">😌</span>
                                    <p className="text-xs text-zinc-500">
                                        新しい通知はありません
                                    </p>
                                </div>
                            ) : (
                                notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        className="flex items-start gap-3 border-b border-zinc-800/40 px-4 py-3 transition-colors hover:bg-zinc-800/30"
                                    >
                                        <span className="mt-0.5 text-lg">⚡️</span>
                                        <div className="flex flex-1 flex-col gap-1">
                                            <p className="text-xs leading-relaxed">
                                                {getMessage(n)}
                                            </p>
                                            <span className="text-[10px] text-zinc-600">
                                                {timeAgo(n.created_at)}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => markAsRead(n.id)}
                                            disabled={markingId === n.id}
                                            className="mt-0.5 shrink-0 rounded-md bg-zinc-800 px-2 py-1 text-[10px] font-medium text-zinc-400 transition-all hover:bg-zinc-700 hover:text-white active:scale-95 disabled:opacity-50"
                                        >
                                            {markingId === n.id ? (
                                                <Loader2 size={10} className="animate-spin" />
                                            ) : (
                                                "既読"
                                            )}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
