"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import DepositForm from "@/components/DepositForm";

export default function NewChallengePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [taskDescription, setTaskDescription] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="gradient-bg flex min-h-dvh items-center justify-center">
        <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
      </div>
    );
  }

  return (
    <div className="gradient-bg flex min-h-dvh flex-col items-center px-6 pb-20 pt-16">
      {/* ヘッダー */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center gap-3 border-b border-zinc-800/60 bg-zinc-950/80 px-4 py-3 backdrop-blur-md">
        <Link
          href="/"
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-all hover:border-zinc-500 hover:text-zinc-200 active:scale-95"
        >
          ← 戻る
        </Link>
        <span className="text-sm font-bold text-white">チャレンジを宣言する</span>
      </div>

      <div className="mt-6 flex w-full max-w-sm flex-col gap-6">
        {/* タイトル */}
        <div className="flex flex-col gap-2 text-center">
          <span className="text-4xl">⛓️</span>
          <h1 className="text-2xl font-black text-white">覚悟を決めろ</h1>
          <p className="text-sm text-zinc-400">
            目標を宣言し、デポジットで退路を断て。
            <br />
            サボれば仲間に没収される。
          </p>
        </div>

        {/* 目標入力 */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            今回の目標
          </label>
          <textarea
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="例: 週3回ジムに行く、毎日30分コードを書く..."
            maxLength={200}
            rows={3}
            className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20"
          />
          <div className="flex justify-between">
            <p className="text-xs text-zinc-600">具体的に書くほど効果的</p>
            <p className="text-xs text-zinc-600">{taskDescription.length}/200</p>
          </div>
        </div>

        {/* DepositForm: 目標が入力されたときだけ表示 */}
        {taskDescription.trim().length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-800/40 to-transparent" />
              <span className="text-xs font-semibold text-red-400/80 uppercase tracking-wider">
                デポジットで退路を断つ
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-800/40 to-transparent" />
            </div>
            <DepositForm taskDescription={taskDescription.trim()} />
          </div>
        )}

        {/* 目標未入力時のガイド */}
        {taskDescription.trim().length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-800 px-6 py-8 text-center">
            <span className="text-3xl opacity-40">⬆️</span>
            <p className="text-sm text-zinc-600">まず目標を入力すると、デポジットフォームが表示されます</p>
          </div>
        )}
      </div>
    </div>
  );
}
