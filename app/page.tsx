"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

// ── スクロールフェードインフック ──
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function RevealSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // ログイン済み → スクワッドへ
  useEffect(() => {
    if (!authLoading && user) router.replace("/squad");
  }, [user, authLoading, router]);

  // ログイン済みユーザーはローディング表示
  if (authLoading || user) {
    return (
      <div className="gradient-bg flex min-h-dvh items-center justify-center">
        <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-zinc-950 text-white overflow-hidden">
      {/* ══════════════════════════════════════════════
          ヒーローセクション
      ══════════════════════════════════════════════ */}
      <section className="relative flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        {/* 背景演出 */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-red-600/10 blur-[120px]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
        </div>

        <div className="relative flex flex-col items-center gap-8">
          {/* ロゴ */}
          <div className="flex items-center gap-3">
            <span className="text-5xl drop-shadow-[0_0_24px_rgba(239,68,68,0.6)]">🔥</span>
            <h1 className="text-2xl font-black tracking-tight">
              Streak<span className="text-red-500">Squad</span>
            </h1>
          </div>

          {/* キャッチコピー */}
          <div className="flex flex-col gap-4">
            <h2 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              習慣化か、<br />
              <span className="bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">罰金か。</span>
            </h2>
            <p className="mx-auto max-w-xs text-base leading-relaxed text-zinc-400">
              3,000円を賭けろ。<br />
              毎日やるか、仲間に没収されるか。<br />
              <span className="text-zinc-500">それだけのシンプルなルール。</span>
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Link
              href="/login"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 py-4 text-base font-black text-white shadow-xl shadow-red-500/25 transition-all hover:brightness-110 active:scale-[0.97]"
            >
              覚悟を決める
            </Link>
            <p className="text-xs text-zinc-600">
              無料アカウント作成 / ログイン
            </p>
          </div>

          {/* スクロール誘導 */}
          <div className="mt-8 flex flex-col items-center gap-2 animate-bounce">
            <span className="text-xs text-zinc-600">ルールを知る</span>
            <svg className="h-5 w-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          コンセプト
      ══════════════════════════════════════════════ */}
      <section className="relative px-6 py-24">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zinc-950 via-red-950/5 to-zinc-950" />
        <div className="relative mx-auto max-w-sm">
          <RevealSection>
            <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-red-500/80">
              Why Streak Squad?
            </p>
            <h3 className="mt-4 text-center text-2xl font-black leading-tight sm:text-3xl">
              意志の力に<br />頼るな。
            </h3>
            <p className="mt-4 text-center text-sm leading-relaxed text-zinc-400">
              「明日からやる」は一生来ない。<br />
              金を賭けて、仲間に監視されて、<br />
              初めて人は本気になる。
            </p>
          </RevealSection>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          3つのルール（How it works）
      ══════════════════════════════════════════════ */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-sm">
          <RevealSection>
            <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">
              How it works
            </p>
            <h3 className="mt-3 text-center text-2xl font-black">
              3つのルール
            </h3>
          </RevealSection>

          <div className="mt-10 flex flex-col gap-6">
            {/* ルール 1 */}
            <RevealSection delay={100}>
              <div className="relative overflow-hidden rounded-2xl border border-red-900/40 bg-gradient-to-br from-red-950/40 to-zinc-900 p-6">
                <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-red-500/10 blur-2xl" />
                <div className="relative">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-lg font-black text-red-400">1</span>
                    <h4 className="text-base font-black text-white">デポジットを賭けろ</h4>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    最低<span className="font-bold text-red-400">3,000円</span>を与信枠として差し出す。<br />
                    これがお前の覚悟の証明だ。サボらなければ1円も請求されない。
                  </p>
                </div>
              </div>
            </RevealSection>

            {/* ルール 2 */}
            <RevealSection delay={200}>
              <div className="relative overflow-hidden rounded-2xl border border-orange-900/40 bg-gradient-to-br from-orange-950/30 to-zinc-900 p-6">
                <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-orange-500/10 blur-2xl" />
                <div className="relative">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/20 text-lg font-black text-orange-400">2</span>
                    <h4 className="text-base font-black text-white">毎日、証拠を出せ</h4>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    スクワッドに証拠写真を毎日投稿。<br />
                    言い訳は不要。写真が全てを語る。<br />
                    <span className="text-zinc-500">仲間がお前を見ている。</span>
                  </p>
                </div>
              </div>
            </RevealSection>

            {/* ルール 3 */}
            <RevealSection delay={300}>
              <div className="relative overflow-hidden rounded-2xl border border-zinc-700/60 bg-gradient-to-br from-zinc-800/60 to-zinc-900 p-6">
                <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-zinc-500/10 blur-2xl" />
                <div className="relative">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-500/20 text-lg font-black text-zinc-300">3</span>
                    <h4 className="text-base font-black text-white">サボれば、全滅</h4>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    1人でも未提出なら、チーム全員のストリークが<span className="font-bold text-red-400">リセット</span>。<br />
                    サボった本人のデポジットは<span className="font-bold text-red-400">即没収</span>。<br />
                    連帯責任。逃げ場はない。
                  </p>
                </div>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          フリーズ機能
      ══════════════════════════════════════════════ */}
      <section className="relative px-6 py-20">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zinc-950 via-cyan-950/5 to-zinc-950" />
        <div className="relative mx-auto max-w-sm">
          <RevealSection>
            <div className="rounded-2xl border border-cyan-900/40 bg-gradient-to-br from-cyan-950/30 to-zinc-900 p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-3xl">❄️</span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500/80">悪魔の救済措置</p>
                  <h4 className="text-lg font-black text-white">フリーズ</h4>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-zinc-400">
                どうしてもサボりたい日がある？<br />
                <span className="font-bold text-cyan-400">500円</span>払えば、1日だけ処刑を回避できる。<br />
                ただし、チャレンジにつき<span className="font-bold text-white">1回限り</span>。
              </p>

              <div className="mt-4 rounded-xl border border-cyan-900/30 bg-cyan-950/20 px-4 py-3">
                <p className="text-xs text-zinc-500">
                  3,000円の没収 vs 500円のフリーズ。<br />
                  <span className="text-cyan-400">賢い選択か、甘えか。それはお前が決めろ。</span>
                </p>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          数字で語るセクション
      ══════════════════════════════════════════════ */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-sm">
          <RevealSection>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "30", unit: "日間", label: "チャレンジ期間" },
                { value: "¥3,000", unit: "~", label: "デポジット" },
                { value: "24h", unit: "", label: "提出期限" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-5"
                >
                  <span className="text-xl font-black text-red-400">{item.value}<span className="text-xs text-zinc-500">{item.unit}</span></span>
                  <span className="text-[10px] text-zinc-500">{item.label}</span>
                </div>
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          最後の一押し
      ══════════════════════════════════════════════ */}
      <section className="relative px-6 py-24">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 bottom-0 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-red-600/10 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-sm text-center">
          <RevealSection>
            <h3 className="text-3xl font-black leading-tight sm:text-4xl">
              本気で変わりたい<br />
              <span className="bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">奴だけ来い。</span>
            </h3>
            <p className="mt-4 text-sm text-zinc-500">
              楽な道はない。だからこそ、続いた時の価値がある。
            </p>

            <Link
              href="/login"
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 py-4 text-base font-black text-white shadow-xl shadow-red-500/25 transition-all hover:brightness-110 active:scale-[0.97]"
            >
              今すぐ始める
            </Link>
            <p className="mt-3 text-xs text-zinc-600">
              無料アカウント作成 / ログイン
            </p>
          </RevealSection>
        </div>
      </section>

      {/* ── フッター ── */}
      <footer className="border-t border-zinc-800/60 px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg">🔥</span>
          <span className="text-sm font-bold text-zinc-500">Streak Squad</span>
        </div>
        <p className="mt-2 text-xs text-zinc-700">&copy; 2026 Streak Squad. All rights reserved.</p>
      </footer>
    </div>
  );
}
