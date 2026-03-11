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
              <h2 className="text-base font-black text-white">ホーム画面に追加してください</h2>
              <p className="text-xs text-zinc-500">iOS で通知を受け取るには PWA が必要です</p>
            </div>
          </div>

          <ol className="mb-5 flex flex-col gap-2 text-sm text-zinc-300">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-400">1</span>
              Safari 下部の <span className="mx-1 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs">共有</span> ボタンをタップ
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-400">2</span>
              「<span className="font-semibold text-white">ホーム画面に追加</span>」を選択
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-400">3</span>
              ホーム画面のアイコンからアプリを開く
            </li>
          </ol>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="w-full rounded-xl border border-zinc-700 py-3 text-sm font-semibold text-zinc-400 transition-all hover:border-zinc-500 hover:text-zinc-200"
          >
            あとで
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
            onClick={async () => {
              const permission = await Notification.requestPermission();
              if (permission === "granted") {
                await registerToken(userId, onStatusChange);
              } else {
                onStatusChange("denied");
              }
              setDismissed(true);
            }}
            className="w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-3.5 text-sm font-black text-white shadow-lg shadow-red-900/40 transition-all hover:brightness-110 active:scale-[0.97]"
          >
            🔔 通知を許可する
          </button>
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              onStatusChange("denied");
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
