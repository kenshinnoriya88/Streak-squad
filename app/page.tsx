"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import PersonalStreak, {
  calcStreakForUser,
  fireConfetti,
} from "@/components/PersonalStreak";
import FriendsStreakBoard from "@/components/FriendsStreakBoard";

interface Workout {
  id: string;
  image_url: string;
  user_name: string | null;
  created_at: string;
}

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading, displayName, signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── ストリーク & セレブレーション ──
  const [streak, setStreak] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationStreak, setCelebrationStreak] = useState(0);

  // ── 未ログイン → /login へリダイレクト ──
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  // ── タイムライン取得 ──
  const fetchWorkouts = useCallback(async () => {
    const { data, error } = await supabase
      .from("workouts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("データ取得エラー:", error);
      return;
    }
    const wks = data ?? [];
    setWorkouts(wks);
    setIsLoading(false);
  }, []);

  // ストリークはworkouts更新時に再計算
  useEffect(() => {
    if (displayName && workouts.length >= 0) {
      setStreak(calcStreakForUser(workouts, displayName));
    }
  }, [workouts, displayName]);

  useEffect(() => {
    if (user) fetchWorkouts();
  }, [user, fetchWorkouts]);

  // ── ファイル選択 ──
  const handleButtonClick = () => fileInputRef.current?.click();

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      setSelectedFile(file);
    },
    [previewUrl],
  );

  // ── アップロード & DB保存 ──
  const handleSubmit = async () => {
    if (!selectedFile || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const ext = selectedFile.name.split(".").pop() || "jpg";
      const filePath = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("workout_images")
        .upload(filePath, selectedFile, { cacheControl: "3600", upsert: false });

      if (uploadError) throw new Error(`アップロード失敗: ${uploadError.message}`);

      const { data: urlData } = supabase.storage
        .from("workout_images")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase.from("workouts").insert({
        image_url: urlData.publicUrl,
        user_name: displayName,
        created_at: new Date().toISOString(),
      });

      if (insertError) throw new Error(`DB保存失敗: ${insertError.message}`);

      // タイムライン更新
      resetState();
      const { data: freshData } = await supabase
        .from("workouts")
        .select("*")
        .order("created_at", { ascending: false });
      const wks = freshData ?? [];
      setWorkouts(wks);
      const newStreak = calcStreakForUser(wks, displayName);
      setStreak(newStreak);

      // 🎉 達成演出
      setCelebrationStreak(newStreak);
      setShowCelebration(true);
      fireConfetti();
    } catch (err) {
      const message = err instanceof Error ? err.message : "不明なエラー";
      alert(`❌ エラーが発生しました\n\n${message}`);
      console.error("送信エラー:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetState = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── ユーティリティ ──
  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "たった今";
    if (mins < 60) return `${mins}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    return new Date(iso).toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
  };

  const getInitial = (name: string | null) => (name ? name.charAt(0).toUpperCase() : "?");

  const getAvatarColor = (name: string | null) => {
    if (!name) return "from-zinc-500 to-zinc-600";
    const colors = [
      "from-indigo-500 to-purple-600",
      "from-rose-500 to-pink-600",
      "from-amber-500 to-orange-600",
      "from-emerald-500 to-teal-600",
      "from-cyan-500 to-blue-600",
      "from-fuchsia-500 to-violet-600",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  const getStreakMessage = (s: number) => {
    if (s >= 30) return "伝説級 🏆";
    if (s >= 14) return "神モード ⚡";
    if (s >= 7) return "絶好調！ 🚀";
    if (s >= 3) return "いい感じ！ 💪";
    if (s >= 1) return "スタート！ 🌱";
    return "今日から始めよう";
  };

  // ── ローディング / 未認証 ──
  if (authLoading || !user) {
    return (
      <div className="gradient-bg flex min-h-dvh items-center justify-center">
        <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
      </div>
    );
  }

  return (
    <div className="gradient-bg flex min-h-dvh flex-col items-center px-6 pb-20 pt-16">
      {/* ── ヘッダーバー ── */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-zinc-800/60 bg-zinc-950/80 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(displayName)} text-xs font-bold text-white`}
          >
            {getInitial(displayName)}
          </div>
          <span className="text-sm font-medium text-zinc-300">{displayName}</span>
        </div>

        {/* ストリーク in ヘッダー */}
        <div className="flex items-center gap-1.5">
          <span
            className={`text-xl transition-all duration-300 ${streak > 0 ? "drop-shadow-[0_0_6px_rgba(249,115,22,0.6)]" : "grayscale opacity-50"
              }`}
          >
            🔥
          </span>
          <span
            className={`text-lg font-bold tabular-nums ${streak > 0
                ? "bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent"
                : "text-zinc-600"
              }`}
          >
            {streak}
          </span>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-all hover:border-zinc-500 hover:text-zinc-200 active:scale-95"
        >
          ログアウト
        </button>
      </div>

      {/* ── PersonalStreak コンポーネント ── */}
      <div className="mt-2">
        <PersonalStreak
          workouts={workouts}
          displayName={displayName}
          streak={streak}
        />
      </div>

      {/* ── FriendsStreakBoard コンポーネント ── */}
      <div className="mt-4">
        <FriendsStreakBoard workouts={workouts} />
      </div>

      {/* decorative rings */}
      {!previewUrl && (
        <div className="pointer-events-none absolute top-0 left-0 right-0 flex h-[600px] items-center justify-center overflow-hidden">
          <div className="pulse-ring h-72 w-72 rounded-full border border-indigo-500/20" />
        </div>
      )}

      <main className="relative z-10 mt-6 flex w-full max-w-sm flex-col items-center gap-8 text-center">
        {/* icon */}
        <div className="float-animation flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-4xl shadow-lg shadow-indigo-500/30">
          💪
        </div>

        {/* heading */}
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">
            連帯責任筋トレアプリ
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              MVP
            </span>
          </h1>
          <p className="text-base text-zinc-400">
            仲間と一緒に、毎日の筋トレを続けよう
          </p>
        </div>

        {/* hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
          aria-label="写真を撮影または選択"
        />

        {/* CTA button */}
        <button
          type="button"
          onClick={handleButtonClick}
          disabled={isSubmitting}
          className="btn-glow relative w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-xl shadow-indigo-500/25 transition-all duration-300 hover:shadow-indigo-500/40 hover:brightness-110 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
        >
          {previewUrl ? "📸 別の写真を撮り直す" : "📸 今日の筋トレを証明する"}
        </button>

        {/* preview area */}
        {previewUrl && (
          <div className="preview-appear flex w-full flex-col gap-4">
            <div className="relative overflow-hidden rounded-2xl border-2 border-indigo-500/30 shadow-lg shadow-indigo-500/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="撮影した筋トレの写真"
                className="h-auto w-full object-cover"
              />
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                <span className="inline-block h-2 w-2 rounded-full bg-green-400 shadow-sm shadow-green-400/50" />
                プレビュー
              </div>
            </div>
            <div className="flex w-full flex-col gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="btn-glow w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-4 text-lg font-semibold text-white shadow-xl shadow-emerald-500/25 transition-all duration-300 hover:shadow-emerald-500/40 hover:brightness-110 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-70"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    送信中...
                  </span>
                ) : (
                  "✅ この写真で記録する"
                )}
              </button>
              <button
                type="button"
                onClick={resetState}
                disabled={isSubmitting}
                className="w-full rounded-2xl border border-zinc-700 px-8 py-3 text-sm font-medium text-zinc-400 transition-all duration-300 hover:border-zinc-500 hover:text-zinc-300 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
              >
                やり直す
              </button>
            </div>
          </div>
        )}

        {!previewUrl && (
          <p className="text-sm text-zinc-500">ボタンを押してカメラで筋トレを記録</p>
        )}

        {/* ────────── タイムライン ────────── */}
        <div className="mt-4 flex w-full flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
            <h2 className="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
              🔥 みんなの記録
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
              <p className="text-sm text-zinc-500">読み込み中...</p>
            </div>
          ) : workouts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-700 px-6 py-10">
              <span className="text-4xl">🏋️</span>
              <p className="text-base font-medium text-zinc-300">まだ今日の記録はありません</p>
              <p className="text-sm text-zinc-500">一番乗りを目指そう！</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {workouts.map((w, i) => (
                <div
                  key={w.id}
                  className="timeline-card group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm transition-all duration-300 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(w.user_name)} text-sm font-bold text-white shadow-sm`}
                    >
                      {getInitial(w.user_name)}
                    </div>
                    <div className="flex flex-1 flex-col items-start">
                      <span className="text-sm font-semibold text-white">
                        {w.user_name || "匿名"}
                      </span>
                      <span className="text-xs text-zinc-500">{formatTime(w.created_at)}</span>
                    </div>
                    <span className="text-xs font-medium text-emerald-400">✅ 完了</span>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={w.image_url}
                    alt={`${w.user_name ?? "匿名"}の筋トレ証明写真`}
                    className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <span className="text-base">💪</span>
                    <span className="text-sm text-zinc-400">
                      <span className="font-medium text-zinc-200">{w.user_name || "匿名"}</span>
                      {" さんが筋トレを完了！"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="mt-12 text-xs text-zinc-600">Streak Squad &copy; 2026</footer>

      {/* ──────── 🎉 達成セレブレーションモーダル ──────── */}
      {showCelebration && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowCelebration(false)}
        >
          <div
            className="celebration-pop flex flex-col items-center gap-6 rounded-3xl border border-orange-500/30 bg-gradient-to-b from-zinc-900 to-zinc-950 px-8 py-10 shadow-2xl shadow-orange-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <span className="text-7xl drop-shadow-[0_0_20px_rgba(249,115,22,0.6)]">🔥</span>
              <div className="absolute -inset-4 -z-10 animate-pulse rounded-full bg-orange-500/20 blur-xl" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-2xl font-black text-white">ストリーク継続！</h2>
              <div className="flex items-baseline gap-1">
                <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-6xl font-black tabular-nums text-transparent">
                  {celebrationStreak}
                </span>
                <span className="text-2xl font-bold text-orange-400">日目！</span>
              </div>
            </div>
            <p className="text-sm text-zinc-400">{getStreakMessage(celebrationStreak)}</p>
            <div className="flex gap-1.5">
              {[...Array(Math.min(celebrationStreak, 14))].map((_, i) => (
                <div
                  key={i}
                  className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 shadow-sm shadow-orange-400/40"
                  style={{ animationDelay: `${i * 100}ms` }}
                />
              ))}
              {celebrationStreak > 14 && (
                <span className="text-xs text-orange-400/60">+{celebrationStreak - 14}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowCelebration(false)}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-base font-bold text-white shadow-lg shadow-orange-500/25 transition-all hover:brightness-110 active:scale-95"
            >
              🎉 やったね！
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
