"use client";

import { useState } from "react";
import { registerToken } from "@/hooks/useFCMToken";
import type { FCMStatus } from "@/hooks/useFCMToken";

interface Props {
  userId: string;
  status: FCMStatus;
  onStatusChange: (s: FCMStatus) => void;
}

export default function NotificationPermissionModal({ userId, status, onStatusChange }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // 表示しないケース
  if (dismissed) return null;
  if (status !== "need_permission" && status !== "ios_browser") return null;

  // ── iOS Safari（ホーム画面未追加）案内 ─────────────────────
  if (status === "ios_browser") {
    return (
      <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-8">
        <div className="w-full max-w-sm rounded-3xl border border-amber-700/40 bg-zinc-950 p-6 shadow-2xl">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-3xl">📲</span>
            <div>
              <h2 className="text-base font-black text-white">Safariから追加してください</h2>
              <p className="text-xs text-zinc-500">iOS で通知を受け取るにはSafariからPWA追加が必要です</p>
            </div>
          </div>

          <ol className="mb-5 flex flex-col gap-2 text-sm text-zinc-300">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-400">1</span>
              <span><span className="font-semibold text-white">Safari</span> でこのページを開く</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-400">2</span>
              <span>下部の <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs">共有</span> → 「<span className="font-semibold text-white">ホーム画面に追加</span>」</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-400">3</span>
              ホーム画面のアイコンからアプリを開く
            </li>
          </ol>

          <p className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[11px] text-zinc-500">
            ※ Chrome等のiOSブラウザではAppleの制限により通知が使えません。通知なしでもPokeの送信は可能です。
          </p>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="w-full rounded-xl border border-zinc-700 py-3 text-sm font-semibold text-zinc-400 transition-all hover:border-zinc-500 hover:text-zinc-200"
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }

  // ── 通常ブラウザ向け許可ダイアログ ──────────────────────────
  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-8">
      <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-4 text-center">
          <span className="text-5xl">🔔</span>
          <h2 className="mt-3 text-lg font-black text-white">Poke 通知を受け取る</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
            仲間がサボったとき、あなたが気づいた瞬間にPoke通知を送れます。<br />
            <span className="text-zinc-500">あなた自身もサボると即Pokeされます。</span>
          </p>
        </div>

        <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-center text-xs text-zinc-500">
          「👊 <span className="text-zinc-300 font-semibold">○○ があなたをPokeしました！記録を止めるな！</span>」
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={isRegistering}
            onClick={async () => {
              setIsRegistering(true);
              try {
                const permission = await Notification.requestPermission();
                console.log("[通知モーダル] permission:", permission);
                if (permission === "granted") {
                  await registerToken(userId, onStatusChange);
                  setDismissed(true);
                } else {
                  onStatusChange("denied");
                  setDismissed(true);
                }
              } catch (err) {
                console.error("[通知モーダル] エラー:", err);
                onStatusChange("error");
              } finally {
                setIsRegistering(false);
              }
            }}
            className="w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-3.5 text-sm font-black text-white shadow-lg shadow-red-900/40 transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
          >
            {isRegistering ? "登録中..." : "🔔 通知を許可する"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
            }}
            className="w-full py-2 text-xs text-zinc-600 hover:text-zinc-400"
          >
            今は不要
          </button>
        </div>
      </div>
    </div>
  );
}
