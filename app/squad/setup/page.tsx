"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

export default function SquadSetupPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [squadName, setSquadName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [createError, setCreateError] = useState("");
  const [joinError, setJoinError] = useState("");


  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  const genCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  // ── スクワッド作成（招待コード衝突時はリトライ） ──
  const handleCreate = async () => {
    if (!squadName.trim() || !user) return;
    setIsCreating(true);
    setCreateError("");

    try {
      let squad = null;
      for (let i = 0; i < 5; i++) {
        const code = genCode();
        const { data, error: squadError } = await supabase
          .from("squads")
          .insert({ name: squadName.trim(), invite_code: code })
          .select("id")
          .single();

        // 23505 = unique_violation → 別コードで再試行
        if (squadError?.code === "23505") continue;
        if (squadError) throw new Error(squadError.message);

        squad = data;
        break;
      }

      if (!squad) throw new Error("招待コードの生成に失敗しました。もう一度お試しください。");

      const { error: memberError } = await supabase
        .from("squad_members")
        .insert({ squad_id: squad.id, user_id: user.id, role: "owner" });

      if (memberError) throw new Error(memberError.message);

      router.replace("/squad");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "作成に失敗しました");
      setIsCreating(false);
    }
  };

  // ── 招待コードで参加 ──
  const handleJoin = async () => {
    if (inviteCode.length < 1 || !user) return;
    setIsJoining(true);
    setJoinError("");

    try {
      // invite_code でスクワッドを検索（maybeSingle: 0件でもエラーにしない）
      const { data: squad, error: findError } = await supabase
        .from("squads")
        .select("id, name")
        .eq("invite_code", inviteCode.toUpperCase())
        .maybeSingle();

      if (findError) throw new Error(`検索エラー: ${findError.message}`);
      if (!squad) throw new Error("招待コードが見つかりません。コードを確認してください。");

      // 既に参加済みか確認（maybeSingle: 0件でもエラーにしない）
      const { data: existing } = await supabase
        .from("squad_members")
        .select("id")
        .eq("squad_id", squad.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) throw new Error(`すでに「${squad.name}」に参加しています`);

      // squad_members に追加
      const { error: memberError } = await supabase
        .from("squad_members")
        .insert({ squad_id: squad.id, user_id: user.id, role: "member" });

      if (memberError) throw new Error(`参加登録エラー: ${memberError.message}`);

      router.replace("/squad");
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "参加に失敗しました");
      setIsJoining(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="gradient-bg flex min-h-dvh items-center justify-center">
        <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
      </div>
    );
  }

  return (
    <div className="gradient-bg flex min-h-dvh flex-col items-center px-4 pb-24 pt-16">
      {/* ヘッダー */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center gap-3 border-b border-zinc-800/60 bg-zinc-950/80 px-4 py-3 backdrop-blur-md">
        <Link
          href="/squad"
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
        >
          ← 戻る
        </Link>
        <span className="text-sm font-bold text-white">スクワッド 作成・参加</span>
      </div>

      <div className="mt-4 w-full max-w-sm flex flex-col gap-6">

        {/* ── 新規作成 ── */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-black text-white">新しいスクワッドを作る</h2>
            <p className="text-xs text-zinc-500 mt-0.5">仲間を集めて連帯責任を課せ</p>
          </div>

          <input
            type="text"
            value={squadName}
            onChange={(e) => setSquadName(e.target.value)}
            placeholder="スクワッド名（例: 筋肉番長団）"
            maxLength={30}
            disabled={isCreating}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 disabled:opacity-50"
          />

          <p className="text-xs text-zinc-600">招待コードは作成時に自動生成されます</p>

{createError && (
            <p className="rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-400">
              ❌ {createError}
            </p>
          )}

          <button
            type="button"
            onClick={handleCreate}
            disabled={!squadName.trim() || isCreating}
            className="w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-3.5 text-sm font-black text-white shadow-lg shadow-red-900/40 transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
          >
            {isCreating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                作成中...
              </span>
            ) : "🏴 スクワッドを作成してタイムラインへ"}
          </button>
        </div>

        {/* 仕切り */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-xs text-zinc-600">または</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        {/* ── 招待コードで参加 ── */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-black text-white">招待コードで参加する</h2>
            <p className="text-xs text-zinc-500 mt-0.5">仲間から受け取った6桁のコードを入力</p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="例: AB12CD"
              maxLength={6}
              disabled={isJoining}
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-center font-mono text-lg tracking-widest text-white placeholder-zinc-600 outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 uppercase disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={inviteCode.length < 4 || isJoining}
              className="rounded-xl bg-zinc-800 border border-zinc-700 px-5 text-xs font-bold text-zinc-300 transition-all hover:border-red-500/40 hover:text-white active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              {isJoining ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-400/30 border-t-zinc-400" />
                </span>
              ) : "参加"}
            </button>
          </div>

          {joinError && (
            <p className="rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-400">
              ❌ {joinError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
