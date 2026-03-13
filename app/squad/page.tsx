"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { calcStreakForUser, fireConfetti } from "@/components/PersonalStreak";
import WorkoutComments from "@/components/WorkoutComments";
import { useFCMToken } from "@/hooks/useFCMToken";
import type { FCMStatus } from "@/hooks/useFCMToken";
import { onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "@/lib/firebase";
import NotificationPermissionModal from "@/components/NotificationPermissionModal";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

const STRIPE_ELEMENT_STYLE = {
  style: {
    base: {
      color: "#f4f4f5",
      fontFamily: '"Inter", system-ui, sans-serif',
      fontSize: "15px",
      fontSmoothing: "antialiased",
      "::placeholder": { color: "#52525b" },
      iconColor: "#a1a1aa",
    },
    invalid: { color: "#f87171", iconColor: "#f87171" },
  },
};

interface Workout {
  id: string;
  image_url: string;
  user_name: string | null;
  created_at: string;
  caption?: string | null;
}

interface MemberStatus {
  userId: string;
  name: string;
  submittedToday: boolean;
}

// ローカル日付文字列（YYYY-MM-DD）を返す
const toLocalDateStr = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// チーム連続記録: 全メンバーが提出した連続日数を計算
function calcTeamStreak(workouts: Workout[], memberNames: string[]): number {
  if (memberNames.length === 0) return 0;
  let streak = 0;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  for (let daysAgo = 0; daysAgo < 365; daysAgo++) {
    const dayStart = new Date(todayStart.getTime() - daysAgo * 86_400_000);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const allSubmitted = memberNames.every((name) =>
      workouts.some((w) => {
        const d = new Date(w.created_at);
        return w.user_name === name && d >= dayStart && d < dayEnd;
      })
    );
    if (allSubmitted) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ── フリーズ購入モーダル内部（Stripe Elements内で使う）──
function FreezeFormInner({
  challengeId,
  userId,
  onSuccess,
  onClose,
}: {
  challengeId: string;
  userId: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setStatus("loading");
    setMessage("");

    try {
      // 1. PaymentIntent 作成
      const res = await fetch("/api/stripe/purchase-freeze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, userId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `APIエラー (${res.status})`);
      }
      const { clientSecret, paymentIntentId } = await res.json();

      // 2. カード決済確定
      const cardNumberElement = elements.getElement(CardNumberElement);
      if (!cardNumberElement) throw new Error("カード情報が取得できませんでした");

      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: { address: { country: "JP" } },
        },
      });
      if (error) throw new Error(error.message ?? "決済に失敗しました");

      // 3. フリーズ有効化
      const confirmRes = await fetch("/api/stripe/confirm-freeze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, userId, paymentIntentId }),
      });
      if (!confirmRes.ok) {
        const err = await confirmRes.json().catch(() => ({}));
        throw new Error(err.error ?? "フリーズ有効化に失敗");
      }

      setStatus("success");
      setMessage("フリーズが有効になりました！今日サボっても没収されません。");
      setTimeout(() => onSuccess(), 1500);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "不明なエラー");
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-cyan-900/50 bg-zinc-950 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">❄️</span>
            <h3 className="text-base font-black text-white">フリーズ購入</h3>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg">✕</button>
        </div>

        <div className="mb-4 rounded-xl border border-cyan-900/30 bg-cyan-950/20 px-4 py-3">
          <p className="text-sm font-bold text-cyan-300 mb-1">¥500 でフリーズできます</p>
          <p className="text-xs leading-relaxed text-zinc-400">
            今日の未提出を免除し、デポジット没収をスキップできます。<br />
            フリーズは1チャレンジにつき1回のみ使用可能です。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">カード番号</label>
            <div className="rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 focus-within:border-cyan-500/60 transition-all">
              <CardNumberElement options={STRIPE_ELEMENT_STYLE} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">有効期限</label>
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 focus-within:border-cyan-500/60 transition-all">
                <CardExpiryElement options={STRIPE_ELEMENT_STYLE} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">CVC</label>
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 focus-within:border-cyan-500/60 transition-all">
                <CardCvcElement options={STRIPE_ELEMENT_STYLE} />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={status === "loading" || !stripe || status === "success"}
            className="mt-1 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-sm font-black text-white shadow-lg shadow-cyan-900/30 transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
          >
            {status === "loading" ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                処理中...
              </span>
            ) : "❄️ ¥500 でフリーズを購入する"}
          </button>
        </form>

        {message && (
          <div className={`mt-3 rounded-xl border px-4 py-3 text-xs leading-relaxed ${
            status === "success"
              ? "border-emerald-700/50 bg-emerald-900/20 text-emerald-400"
              : "border-red-700/50 bg-red-900/20 text-red-400"
          }`}>
            {status === "success" ? "✅ " : "❌ "}{message}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SquadPage() {
  const router = useRouter();
  const { user, loading: authLoading, displayName } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [caption, setCaption] = useState("");
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [noSquad, setNoSquad] = useState(false);
  const [squadInfo, setSquadInfo] = useState<{ name: string; invite_code: string } | null>(null);
  const [currentSquadId, setCurrentSquadId] = useState<string | null>(null);
  const [teamStreak, setTeamStreak] = useState(0);
  const [memberStatuses, setMemberStatuses] = useState<MemberStatus[]>([]);
  const [pokedNames, setPokedNames] = useState<Set<string>>(new Set());
  const [pokeResults, setPokeResults] = useState<Map<string, "sending" | "sent" | "no_sub" | "error">>(new Map());
  const [codeCopied, setCodeCopied] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationStreak, setCelebrationStreak] = useState(0);
  const [hasActiveChallenge, setHasActiveChallenge] = useState<boolean | null>(null);
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [freezeActive, setFreezeActive] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  // FCM 通知ステータス（モーダルからも更新できるよう state で管理）
  const fcmStatusFromHook = useFCMToken(user?.id);
  const [fcmStatus, setFcmStatus] = useState<FCMStatus>("idle");
  const [showNotifModal, setShowNotifModal] = useState(false);
  useEffect(() => { setFcmStatus(fcmStatusFromHook); }, [fcmStatusFromHook]);

  const fetchWorkouts = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    // Step 0: スクワッド所属 & アクティブチャレンジを並行取得
    const [membershipsResult, challengeResult] = await Promise.all([
      supabase.from("squad_members").select("squad_id").eq("user_id", user.id),
      supabase
        .from("challenges")
        .select("id, freeze_active")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
    ]);

    setHasActiveChallenge(!!challengeResult.data);
    setActiveChallengeId(challengeResult.data?.id ?? null);
    setFreezeActive(!!challengeResult.data?.freeze_active);

    const { data: memberships, error: membershipError } = membershipsResult;

    if (membershipError || !memberships || memberships.length === 0) {
      setNoSquad(true);
      setWorkouts([]);
      setIsLoading(false);
      return;
    }

    setNoSquad(false);
    const squadIds = memberships.map((m) => m.squad_id);
    setCurrentSquadId(squadIds[0]);

    // スクワッド情報（名前・招待コード）
    const { data: squadData } = await supabase
      .from("squads")
      .select("name, invite_code")
      .eq("id", squadIds[0])
      .single();
    if (squadData) setSquadInfo(squadData);

    // Step 2: 同スクワッドの全メンバーのuser_idを取得
    const { data: allMembers } = await supabase
      .from("squad_members")
      .select("user_id")
      .in("squad_id", squadIds);

    const memberIds = [...new Set((allMembers ?? []).map((m) => m.user_id))];

    // Step 3: user_id → display_name を profiles テーブルで解決
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", memberIds);

    // プロフィールがないメンバーにも fallback 名を割り当てる
    const profileMap = new Map<string, string>();
    (profiles ?? []).forEach((p) => {
      if (p.display_name) profileMap.set(p.id as string, p.display_name as string);
    });
    const memberNameMap = new Map<string, string>(
      memberIds.map((id) => [id, profileMap.get(id) ?? id.slice(0, 8)])
    );
    const memberNames = [...memberNameMap.values()];

    // Step 4: workoutsを現在のスクワッドIDでフィルタリング
    const { data, error } = await supabase
      .from("workouts")
      .select("*")
      .eq("squad_id", squadIds[0])
      .order("created_at", { ascending: false });

    const wks: Workout[] = error ? [] : (data ?? []);
    setWorkouts(wks);

    // ── チーム連続記録を計算 ──
    setTeamStreak(calcTeamStreak(wks, memberNames));

    // ── 本日の提出ステータスを全メンバー分計算 ──
    const todayStr = toLocalDateStr(new Date());
    const statuses: MemberStatus[] = memberIds.map((id) => {
      const name = memberNameMap.get(id)!;
      return {
        userId: id,
        name,
        submittedToday: wks.some(
          (w) => w.user_name === name && toLocalDateStr(new Date(w.created_at)) === todayStr
        ),
      };
    });
    // 未提出を先頭に（プレッシャー優先）
    statuses.sort((a, b) => Number(a.submittedToday) - Number(b.submittedToday));
    setMemberStatuses(statuses);

    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) fetchWorkouts();
  }, [user, fetchWorkouts]);

  // フォアグラウンドでのFCM通知受信
  useEffect(() => {
    if (fcmStatus !== "subscribed") return;
    const messaging = getFirebaseMessaging();
    if (!messaging) return;
    const unsubscribe = onMessage(messaging, (payload) => {
      const title = payload.notification?.title ?? "Streak Squad";
      const body = payload.notification?.body ?? "";
      // アプリ内トースト表示
      setToast({ title, body });
      setTimeout(() => setToast(null), 4000);
      // OS通知も試行
      try { new Notification(title, { body, icon: "/icon-192.png" }); } catch {}
    });
    return () => unsubscribe();
  }, [fcmStatus]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      setSelectedFile(file);
    },
    [previewUrl]
  );

  const resetState = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    setCaption("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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

      const { data: urlData } = supabase.storage.from("workout_images").getPublicUrl(filePath);

      const { error: insertError } = await supabase.from("workouts").insert({
        image_url: urlData.publicUrl,
        user_name: displayName,
        created_at: new Date().toISOString(),
        caption: caption.trim() || null,
        squad_id: currentSquadId,
      });
      if (insertError) throw new Error(`DB保存失敗: ${insertError.message}`);

      resetState();
      await fetchWorkouts();

      const newStreak = calcStreakForUser(workouts, displayName);
      setCelebrationStreak(newStreak);
      setShowCelebration(true);
      fireConfetti();
    } catch (err) {
      alert(`❌ エラー\n${err instanceof Error ? err.message : "不明なエラー"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePoke = async (userId: string, name: string) => {
    setPokedNames((prev) => new Set(prev).add(userId));
    setPokeResults((prev) => new Map(prev).set(userId, "sending"));
    try {
      const res = await fetch("/api/push/poke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: userId, fromName: displayName }),
      });
      const body = await res.json();
      console.log("[Poke]", name, "→", body);
      if (!res.ok) {
        setPokeResults((prev) => new Map(prev).set(userId, "error"));
      } else if (body.sent === false) {
        setPokeResults((prev) => new Map(prev).set(userId, "no_sub"));
      } else {
        setPokeResults((prev) => new Map(prev).set(userId, "sent"));
      }
    } catch (err) {
      console.warn("[handlePoke]", err);
      setPokeResults((prev) => new Map(prev).set(userId, "error"));
    }
  };

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

  const getAvatarColor = (name: string | null) => {
    if (!name) return "from-zinc-500 to-zinc-600";
    const colors = [
      "from-red-500 to-rose-600", "from-orange-500 to-red-600",
      "from-rose-500 to-pink-600", "from-red-600 to-orange-500",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitial = (name: string | null) => (name ? name.charAt(0).toUpperCase() : "?");

  if (authLoading || !user) {
    return (
      <div className="gradient-bg flex min-h-dvh items-center justify-center">
        <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
      </div>
    );
  }

  return (
    <div className="gradient-bg flex min-h-dvh flex-col items-center px-4 pb-24 pt-24">
      {/* ── ヘッダー ── */}
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm font-bold text-white">
            {squadInfo ? `👥 ${squadInfo.name}` : "👥 スクワッド"}
          </span>
          <div className="flex items-center gap-2">
            {/* 通知登録ステータス */}
            {fcmStatus === "subscribed" && (
              <span className="rounded-full bg-emerald-900/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                🔔 通知ON
              </span>
            )}
            {(fcmStatus === "denied" || fcmStatus === "need_permission" || fcmStatus === "ios_browser" || fcmStatus === "unsupported" || fcmStatus === "error") && (
              <button
                type="button"
                onClick={() => setShowNotifModal(true)}
                className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-400 hover:text-zinc-200 transition-all"
              >
                {fcmStatus === "ios_browser" ? "📲 通知設定" : fcmStatus === "unsupported" ? "🚫 通知設定" : "🔕 通知をONにする"}
              </button>
            )}
            <Link
              href="/squad/setup"
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-all hover:border-zinc-500 hover:text-zinc-200"
            >
              + 作成・参加
            </Link>
          </div>
        </div>
        {squadInfo?.invite_code && (
          <div className="flex items-center justify-center gap-2 border-t border-zinc-800/50 bg-zinc-900/60 px-4 py-1.5">
            <span className="text-[10px] text-zinc-500">招待コード</span>
            <span className="font-mono text-sm font-black tracking-widest text-white select-all">
              {squadInfo.invite_code}
            </span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(squadInfo.invite_code);
                } catch {
                  // fallback: テキスト選択
                  const el = document.createElement("textarea");
                  el.value = squadInfo.invite_code;
                  document.body.appendChild(el);
                  el.select();
                  document.execCommand("copy");
                  document.body.removeChild(el);
                }
                setCodeCopied(true);
                setTimeout(() => setCodeCopied(false), 2000);
              }}
              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all active:scale-95 ${
                codeCopied
                  ? "bg-emerald-900/40 text-emerald-400"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {codeCopied ? "✅ コピー済" : "コピー"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 w-full max-w-sm flex flex-col gap-5">
        {/* ── スクワッド未所属 ── */}
        {noSquad ? (
          <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-12 text-center">
            <span className="text-5xl opacity-40">🔒</span>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-base font-black text-white">スクワッドに参加していません</h2>
              <p className="text-sm leading-relaxed text-zinc-500">
                まずはスクワッドを作成するか、<br />招待コードで参加してください。
              </p>
            </div>
            <Link
              href="/squad/setup"
              className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-red-900/40 transition-all hover:brightness-110 active:scale-95"
            >
              スクワッドを作成・参加する
            </Link>
          </div>
        ) : hasActiveChallenge === false ? (
          /* ── チャレンジ未設定ロック画面 ── */
          <div className="flex flex-col gap-5">
            {/* フロー説明 */}
            <div className="flex flex-col gap-2">
              {[
                { step: "1", label: "アカウント作成", done: true },
                { step: "2", label: "スクワッド結成・参加", done: true },
                { step: "3", label: "チャレンジ・デポジット設定", done: false, current: true },
                { step: "4", label: "タイムライン解放", done: false },
              ].map(({ step, label, done, current }) => (
                <div
                  key={step}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                    current
                      ? "border border-red-500/40 bg-red-950/30"
                      : done
                      ? "border border-zinc-800 bg-zinc-900/40 opacity-60"
                      : "border border-zinc-800/50 bg-zinc-900/20 opacity-40"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      done
                        ? "bg-emerald-500/20 text-emerald-400"
                        : current
                        ? "bg-red-500/20 text-red-400"
                        : "bg-zinc-800 text-zinc-600"
                    }`}
                  >
                    {done ? "✓" : step}
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      current ? "text-white" : done ? "text-zinc-400" : "text-zinc-600"
                    }`}
                  >
                    {label}
                  </span>
                  {current && (
                    <span className="ml-auto rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400 animate-pulse">
                      NOW
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* ロックメッセージ */}
            <div className="relative overflow-hidden rounded-2xl border border-red-900/50 bg-gradient-to-b from-red-950/40 to-zinc-950 px-6 py-8 text-center">
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-red-500/10 blur-2xl" />
              <span className="text-5xl">⛓️</span>
              <h2 className="mt-4 text-lg font-black text-white">
                タイムラインはロック中
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                チャレンジを宣言してデポジットを積むと<br />
                スクワッドのタイムラインが解放されます。
              </p>
              <p className="mt-3 rounded-lg border border-red-900/30 bg-red-950/40 px-3 py-2 text-xs text-red-400">
                ⚠️ サボればデポジット没収。覚悟を示せ。
              </p>
            </div>

            {/* CTA */}
            <Link
              href="/challenges/new"
              className="btn-glow flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 py-4 text-base font-black text-white shadow-xl shadow-red-500/25 transition-all hover:brightness-110 active:scale-[0.97]"
            >
              ⛓️ チャレンジを宣言してロック解除
            </Link>

            {/* スクワッド設定へのリンク */}
            <Link
              href="/squad/setup"
              className="text-center text-xs text-zinc-600 underline underline-offset-2 hover:text-zinc-400"
            >
              別のスクワッドに参加する
            </Link>
          </div>
        ) : (
          <>
            {/* ══════ チーム連続記録パネル ══════ */}
            <div className="relative overflow-hidden rounded-2xl border border-orange-900/50 bg-gradient-to-br from-red-950/80 via-zinc-900/80 to-zinc-950 p-5 shadow-xl shadow-red-950/30">
              {/* 背景グロー */}
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-orange-500/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-red-500/10 blur-2xl" />

              <div className="relative flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-orange-400/80">
                    チーム連続記録
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`text-5xl font-black tabular-nums ${
                        teamStreak > 0
                          ? "bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent"
                          : "text-zinc-600"
                      }`}
                    >
                      {teamStreak}
                    </span>
                    <span className="text-lg font-bold text-orange-400/80">日</span>
                  </div>
                </div>
                <span
                  className={`text-6xl transition-all duration-300 ${
                    teamStreak > 0
                      ? "drop-shadow-[0_0_16px_rgba(249,115,22,0.7)]"
                      : "grayscale opacity-20"
                  }`}
                >
                  🔥
                </span>
              </div>

              <p className="relative mt-3 rounded-lg border border-red-900/30 bg-red-950/40 px-3 py-2 text-[11px] leading-relaxed text-red-400/90">
                ⚠️ 誰か一人でも今日サボれば、全員の記録が0になります。<br />
                <span className="text-zinc-500">（罰金はサボった本人のみ）</span>
              </p>
            </div>

            {/* ══════ 本日のメンバー生存確認 ══════ */}
            {memberStatuses.length > 0 && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-3">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                    🫀 本日の生存確認
                  </span>
                  <span className="ml-auto rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                    {memberStatuses.filter((m) => m.submittedToday).length}/{memberStatuses.length} 人完了
                  </span>
                </div>

                <div className="divide-y divide-zinc-800/50">
                  {memberStatuses.map((m) => (
                    <div key={m.name} className="flex items-center gap-3 px-4 py-3">
                      {/* アバター */}
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white ${
                          m.submittedToday
                            ? getAvatarColor(m.name)
                            : "from-zinc-700 to-zinc-800"
                        }`}
                      >
                        {getInitial(m.name)}
                      </div>

                      {/* 名前 */}
                      <span
                        className={`flex-1 text-sm font-semibold ${
                          m.submittedToday ? "text-white" : "text-zinc-400"
                        }`}
                      >
                        {m.name}
                        {m.name === displayName && (
                          <span className="ml-1.5 text-[10px] font-normal text-zinc-600">（自分）</span>
                        )}
                      </span>

                      {/* ステータスバッジ / Pokeボタン */}
                      {m.submittedToday ? (
                        <span className="rounded-full border border-emerald-700/40 bg-emerald-900/20 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
                          ✅ 完了
                        </span>
                      ) : m.userId === user?.id ? (
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="rounded-full border border-red-700/40 bg-red-900/20 px-2.5 py-1 text-[11px] font-bold text-red-400 animate-pulse">
                            ⚠️ 未提出
                          </span>
                          {activeChallengeId && !freezeActive && (
                            <button
                              type="button"
                              onClick={() => setShowFreezeModal(true)}
                              className="rounded-full border border-cyan-700/50 bg-cyan-900/20 px-2.5 py-1 text-[10px] font-bold text-cyan-400 transition-all hover:bg-cyan-900/40 active:scale-95"
                            >
                              ❄️ フリーズ購入
                            </button>
                          )}
                          {freezeActive && (
                            <span className="rounded-full border border-cyan-700/40 bg-cyan-900/20 px-2.5 py-1 text-[10px] font-bold text-cyan-400">
                              ❄️ フリーズ有効
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <button
                            type="button"
                            onClick={() => handlePoke(m.userId, m.name)}
                            disabled={pokedNames.has(m.userId)}
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95 ${
                              pokeResults.get(m.userId) === "sending"
                                ? "border-zinc-700 text-zinc-500 cursor-default"
                                : pokedNames.has(m.userId)
                                ? "border-zinc-700 text-zinc-600 cursor-default"
                                : "border-orange-700/50 bg-orange-900/20 text-orange-400 hover:bg-orange-900/40"
                            }`}
                          >
                            {pokeResults.get(m.userId) === "sending"
                              ? "送信中..."
                              : pokedNames.has(m.userId)
                              ? "👊 Poke済"
                              : "👊 Poke！"}
                          </button>
                          {pokeResults.get(m.userId) === "sent" && (
                            <span className="text-[9px] text-emerald-500">通知送信済み</span>
                          )}
                          {pokeResults.get(m.userId) === "no_sub" && (
                            <span className="text-[9px] text-zinc-500">相手が通知未登録</span>
                          )}
                          {pokeResults.get(m.userId) === "error" && (
                            <span className="text-[9px] text-red-500">送信失敗</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══════ 証拠写真投稿 ══════ */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                今日の証拠を出せ
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              {!previewUrl ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-glow w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-3.5 text-sm font-black text-white shadow-lg shadow-red-500/25 transition-all hover:brightness-110 active:scale-[0.97]"
                >
                  📸 筋トレ証拠写真を投稿する
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="relative overflow-hidden rounded-xl border-2 border-red-500/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="プレビュー" className="h-auto w-full object-cover" />
                    <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                      プレビュー
                    </div>
                  </div>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="一言コメント（任意）"
                    maxLength={200}
                    rows={2}
                    className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="flex-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-3 text-sm font-black text-white transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          送信中...
                        </span>
                      ) : "✅ 記録する"}
                    </button>
                    <button
                      type="button"
                      onClick={resetState}
                      disabled={isSubmitting}
                      className="rounded-xl border border-zinc-700 px-4 py-3 text-xs text-zinc-400 transition-all hover:border-zinc-500 hover:text-zinc-200"
                    >
                      やり直し
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ══════ タイムライン ══════ */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">🔥 スクワッドの記録</h2>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-zinc-700" />
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
                </div>
              ) : workouts.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-800 py-10 text-center">
                  <span className="text-4xl">🏋️</span>
                  <p className="text-sm text-zinc-500">まだ記録なし。一番乗りを狙え！</p>
                </div>
              ) : (
                workouts.map((w, i) => (
                  <div
                    key={w.id}
                    className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 transition-all hover:border-red-900/40"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(w.user_name)} text-sm font-bold text-white`}>
                        {getInitial(w.user_name)}
                      </div>
                      <div className="flex flex-1 flex-col">
                        <span className="text-sm font-semibold text-white">{w.user_name || "匿名"}</span>
                        <span className="text-xs text-zinc-500">{formatTime(w.created_at)}</span>
                      </div>
                      <span className="text-xs font-medium text-emerald-400">✅ 完了</span>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.image_url} alt="筋トレ証明" className="h-52 w-full object-cover" loading="lazy" />
                    {w.caption && (
                      <div className="px-4 pb-2 pt-2">
                        <p className="rounded-lg bg-zinc-800/50 px-3 py-2 text-sm text-zinc-300">{w.caption}</p>
                      </div>
                    )}
                    <WorkoutComments workoutId={w.id} currentUser={displayName} />
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* 通知許可モーダル */}
      {user && (
        <NotificationPermissionModal
          userId={user.id}
          status={showNotifModal ? (fcmStatus === "subscribed" ? "subscribed" : fcmStatus === "ios_browser" ? "ios_browser" : "need_permission") : fcmStatus}
          onStatusChange={(s) => { setFcmStatus(s); setShowNotifModal(false); }}
        />
      )}

      {/* フリーズ購入モーダル */}
      {showFreezeModal && activeChallengeId && user && (
        <Elements stripe={stripePromise} options={{ locale: "ja" }}>
          <FreezeFormInner
            challengeId={activeChallengeId}
            userId={user.id}
            onSuccess={() => {
              setShowFreezeModal(false);
              setFreezeActive(true);
              fetchWorkouts();
            }}
            onClose={() => setShowFreezeModal(false)}
          />
        </Elements>
      )}

      {/* 達成セレブレーション */}
      {showCelebration && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowCelebration(false)}
        >
          <div
            className="flex flex-col items-center gap-5 rounded-3xl border border-red-500/30 bg-zinc-950 px-8 py-10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-6xl drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]">🔥</span>
            <div className="text-center">
              <h2 className="text-2xl font-black text-white">ストリーク継続！</h2>
              <div className="flex items-baseline justify-center gap-1 mt-1">
                <span className="text-5xl font-black text-red-400">{celebrationStreak}</span>
                <span className="text-xl font-bold text-red-400">日目！</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCelebration(false)}
              className="w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-3 font-bold text-white"
            >
              🎉 やったね！
            </button>
          </div>
        </div>
      )}

      {/* トースト通知 */}
      {toast && (
        <div
          className="fixed left-4 right-4 top-4 z-[9999] animate-[slideDown_0.3s_ease-out] cursor-pointer"
          onClick={() => setToast(null)}
        >
          <div className="mx-auto max-w-sm rounded-2xl border border-orange-500/40 bg-zinc-950/95 px-4 py-3 shadow-2xl shadow-orange-900/30 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👊</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{toast.title}</p>
                <p className="text-xs text-zinc-400 truncate">{toast.body}</p>
              </div>
              <span className="text-[10px] text-zinc-600">今</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
