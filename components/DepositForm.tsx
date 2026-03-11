"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

const ELEMENT_STYLE = {
  style: {
    base: {
      color: "#f4f4f5",
      fontFamily: '"Inter", system-ui, sans-serif',
      fontSize: "15px",
      fontSmoothing: "antialiased",
      "::placeholder": { color: "#52525b" },
      iconColor: "#a1a1aa",
    },
    invalid: {
      color: "#f87171",
      iconColor: "#f87171",
    },
  },
};

interface DepositFormProps {
  taskDescription: string;
}

function DepositFormInner({ taskDescription }: DepositFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState(3000);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    if (!user) {
      setStatus("error");
      setMessage("ログインが必要です");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      // Step 1: PaymentIntent（与信枠）を作成
      const res = await fetch("/api/stripe/create-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, userId: user.id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `APIエラー (${res.status})`);
      }

      const { clientSecret } = await res.json();

      // Step 2: カード情報で与信を確保
      const cardNumberElement = elements.getElement(CardNumberElement);
      if (!cardNumberElement) throw new Error("カード情報が取得できませんでした");

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: { address: { country: "JP" } },
        },
      });

      if (error) throw new Error(error.message ?? "決済に失敗しました");

      // Step 3: Supabase の challenges テーブルに記録
      const { error: dbError } = await supabase.from("challenges").insert({
        user_id: user.id,
        task_description: taskDescription,
        deposit_amount: amount,
        status: "active",
        stripe_payment_intent_id: paymentIntent?.id,
      });

      if (dbError) throw new Error(`DB保存エラー: ${dbError.message}`);

      // Step 4: 成功メッセージ → 2秒後にトップへリダイレクト
      setStatus("success");
      setMessage(`チャレンジを登録しました！\nデポジット ¥${amount.toLocaleString()} の与信確保が完了。\nトップページへ移動します...`);
      setTimeout(() => router.replace("/"), 2000);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "不明なエラーが発生しました");
    }
  };

  const isLoading = status === "loading";

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-2xl border border-red-900/40 bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 shadow-2xl shadow-red-950/30"
    >
      {/* ヘッダー */}
      <div className="mb-6 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔒</span>
          <h2 className="text-lg font-black tracking-tight text-white">
            逃げ場のないデポジット
          </h2>
        </div>
        <p className="text-xs leading-relaxed text-red-400/80">
          サボった瞬間、仲間に請求される。覚悟はあるか。
        </p>
      </div>

      {/* 目標プレビュー */}
      <div className="mb-5 rounded-xl border border-zinc-700/50 bg-zinc-800/30 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">宣言する目標</p>
        <p className="text-sm font-medium text-zinc-200 leading-relaxed">{taskDescription}</p>
      </div>

      {/* 金額入力 */}
      <div className="mb-5 flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          デポジット金額
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 focus-within:border-red-500/60 focus-within:ring-1 focus-within:ring-red-500/20 transition-all">
          <span className="text-sm font-bold text-zinc-400">¥</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            min={3000}
            step={1000}
            required
            disabled={isLoading}
            className="flex-1 bg-transparent text-base font-bold text-white outline-none placeholder-zinc-600 disabled:opacity-50"
          />
        </div>
        <p className="text-xs text-zinc-600">最低3,000円 / 1,000円単位</p>
      </div>

      {/* クイック選択 */}
      <div className="mb-5 flex gap-2">
        {[3000, 5000, 10000].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setAmount(v)}
            disabled={isLoading}
            className={`flex-1 rounded-lg border py-2 text-xs font-bold transition-all active:scale-95 disabled:opacity-40 ${
              amount === v
                ? "border-red-500/60 bg-red-500/10 text-red-400"
                : "border-zinc-700 bg-zinc-800/40 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
            }`}
          >
            ¥{v.toLocaleString()}
          </button>
        ))}
      </div>

      {/* カード番号 */}
      <div className="mb-4 flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          カード番号
        </label>
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3.5 focus-within:border-red-500/60 focus-within:ring-1 focus-within:ring-red-500/20 transition-all">
          <CardNumberElement options={ELEMENT_STYLE} />
        </div>
      </div>

      {/* 有効期限 & CVC */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            有効期限
          </label>
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3.5 focus-within:border-red-500/60 focus-within:ring-1 focus-within:ring-red-500/20 transition-all">
            <CardExpiryElement options={ELEMENT_STYLE} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            CVC
          </label>
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3.5 focus-within:border-red-500/60 focus-within:ring-1 focus-within:ring-red-500/20 transition-all">
            <CardCvcElement options={ELEMENT_STYLE} />
          </div>
        </div>
      </div>

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={isLoading || !stripe || status === "success"}
        className="w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-3.5 text-sm font-black text-white shadow-lg shadow-red-900/40 transition-all duration-300 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            処理中...
          </span>
        ) : (
          `🔒 ¥${amount.toLocaleString()} をデポジットして宣言する`
        )}
      </button>

      {/* ステータスメッセージ */}
      {message && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-xs leading-relaxed whitespace-pre-line ${
            status === "success"
              ? "border-emerald-700/50 bg-emerald-900/20 text-emerald-400"
              : "border-red-700/50 bg-red-900/20 text-red-400"
          }`}
        >
          {status === "success" ? "✅ " : "❌ "}
          {message}
        </div>
      )}

      {/* 注意書き */}
      <p className="mt-4 text-center text-[10px] leading-relaxed text-zinc-700">
        与信枠の確保のみ行います。サボらなければ請求されません。
      </p>
    </form>
  );
}

export default function DepositForm({ taskDescription }: DepositFormProps) {
  return (
    <Elements stripe={stripePromise} options={{ locale: "ja" }}>
      <DepositFormInner taskDescription={taskDescription} />
    </Elements>
  );
}
