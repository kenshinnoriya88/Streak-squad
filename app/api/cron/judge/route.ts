import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

// ── 認証チェック ──────────────────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;
  const urlSecret = new URL(req.url).searchParams.get("secret");
  return urlSecret === secret;
}

// ── JST での「昨日」の UTC 範囲を返す ─────────────────────────
function yesterdayJSTinUTC(): { start: Date; end: Date } {
  const nowUTC = new Date();
  const nowJST = new Date(nowUTC.getTime() + 9 * 60 * 60 * 1000);
  const yStart = new Date(nowJST);
  yStart.setDate(yStart.getDate() - 1);
  yStart.setHours(0, 0, 0, 0);
  const yEnd = new Date(yStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  return {
    start: new Date(yStart.getTime() - 9 * 60 * 60 * 1000),
    end: new Date(yEnd.getTime() - 9 * 60 * 60 * 1000),
  };
}

// ── Stripe Capture（デポジット没収） ──────────────────────────
async function captureDeposit(
  paymentIntentId: string,
  amount: number,
  userId: string,
  log: string[],
  userName: string
): Promise<boolean> {
  if (!paymentIntentId) {
    log.push(`    [${userName}] ⚠️ stripe_payment_intent_id なし → Captureスキップ`);
    return false;
  }
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status === "requires_capture") {
      const captured = await stripe.paymentIntents.capture(paymentIntentId);
      log.push(`    [${userName}] 💸 Capture成功: ¥${amount} (${captured.id})`);
      await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        amount,
        transaction_type: "penalty",
        stripe_charge_id: captured.latest_charge as string,
      });
      return true;
    } else if (pi.status === "succeeded") {
      log.push(`    [${userName}] ⚠️ 既にCapture済み`);
      return true;
    } else if (pi.status === "canceled") {
      log.push(`    [${userName}] ⚠️ 既にCancel済み`);
      return false;
    } else {
      log.push(`    [${userName}] ⚠️ 予期しないステータス: ${pi.status}`);
      return false;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    log.push(`    [${userName}] ❌ Captureエラー: ${message}`);
    return false;
  }
}

// ── Stripe Cancel（デポジット返金/解放） ──────────────────────
async function cancelDeposit(
  paymentIntentId: string,
  amount: number,
  userId: string,
  log: string[],
  userName: string
): Promise<boolean> {
  if (!paymentIntentId) {
    log.push(`    [${userName}] ⚠️ stripe_payment_intent_id なし → Cancelスキップ`);
    return false;
  }
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status === "requires_capture") {
      await stripe.paymentIntents.cancel(paymentIntentId);
      log.push(`    [${userName}] 🔓 Cancel成功: ¥${amount} 解放`);
      return true;
    } else if (pi.status === "canceled") {
      log.push(`    [${userName}] ⚠️ 既にCancel済み`);
      return true;
    } else if (pi.status === "succeeded") {
      log.push(`    [${userName}] ⚠️ 既にCapture済み → Cancel不可`);
      return false;
    } else {
      log.push(`    [${userName}] ⚠️ 予期しないステータス: ${pi.status}`);
      return false;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    log.push(`    [${userName}] ❌ Cancelエラー: ${message}`);
    return false;
  }
}

// ── 30日完走チェック & 完了処理 ───────────────────────────────
async function checkAndCompleteExpired(log: string[]) {
  const now = new Date();
  const CHALLENGE_DAYS = 30;

  // created_at から30日以上経過した active チャレンジを取得
  const cutoff = new Date(now.getTime() - CHALLENGE_DAYS * 86_400_000);

  const { data: expiredChallenges } = await supabaseAdmin
    .from("challenges")
    .select("id, user_id, deposit_amount, stripe_payment_intent_id, created_at")
    .eq("status", "active")
    .lte("created_at", cutoff.toISOString());

  if (!expiredChallenges?.length) {
    log.push("[完走チェック] 期間満了チャレンジなし");
    return;
  }

  for (const challenge of expiredChallenges) {
    // ステータスを completed に更新
    await supabaseAdmin
      .from("challenges")
      .update({ status: "completed" })
      .eq("id", challenge.id);

    // デポジット解放（Cancel）
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", challenge.user_id)
      .maybeSingle();
    const name = (profile?.display_name as string) ?? (challenge.user_id as string).slice(0, 8);

    await cancelDeposit(
      challenge.stripe_payment_intent_id,
      challenge.deposit_amount,
      challenge.user_id,
      log,
      name
    );

    log.push(`[完走チェック] 🎉 [${name}] 30日完走！チャレンジ completed、デポジット ¥${challenge.deposit_amount} 返金`);
  }
}

// ── メインロジック ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { start: dayStart, end: dayEnd } = yesterdayJSTinUTC();
  const log: string[] = [];
  log.push(`judge 開始: 対象日 JST ${dayStart.toISOString()} 〜 ${dayEnd.toISOString()}`);

  // ── 0. 30日完走チェック（期間満了 → completed + Cancel）─────
  await checkAndCompleteExpired(log);

  // ── 1. 全スクワッドを取得 ────────────────────────────────────
  const { data: squads, error: squadsErr } = await supabaseAdmin
    .from("squads")
    .select("id, name, current_streak");

  if (squadsErr || !squads?.length) {
    return NextResponse.json({ log, message: "スクワッドなし or エラー", error: squadsErr });
  }

  const results: Record<string, unknown>[] = [];

  for (const squad of squads) {
    // ── 2. スクワッドメンバーを取得 ────────────────────────────
    const { data: members } = await supabaseAdmin
      .from("squad_members")
      .select("user_id")
      .eq("squad_id", squad.id);

    if (!members?.length) continue;
    const memberIds = members.map((m) => m.user_id as string);

    // ── 3. アクティブなチャレンジを持つメンバーのみ対象 ─────────
    const { data: activeChallenges } = await supabaseAdmin
      .from("challenges")
      .select("id, user_id, deposit_amount, stripe_payment_intent_id, freeze_active")
      .in("user_id", memberIds)
      .eq("status", "active");

    if (!activeChallenges?.length) {
      log.push(`[${squad.name}] アクティブチャレンジなし → スキップ`);
      continue;
    }

    const activeUserIds = [...new Set(activeChallenges.map((c) => c.user_id as string))];

    // ── 4. display_name を解決 ──────────────────────────────────
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", activeUserIds);

    const nameMap = new Map<string, string>();
    (profiles ?? []).forEach((p) => {
      if (p.display_name) nameMap.set(p.id as string, p.display_name as string);
    });

    // ── 5. 昨日の workouts を取得（squad_id でフィルタ）────────
    const displayNames = [...nameMap.values()];
    const { data: yesterdayWorkouts } = displayNames.length
      ? await supabaseAdmin
          .from("workouts")
          .select("user_name")
          .eq("squad_id", squad.id)
          .in("user_name", displayNames)
          .gte("created_at", dayStart.toISOString())
          .lte("created_at", dayEnd.toISOString())
      : { data: [] };

    const submittedNames = new Set((yesterdayWorkouts ?? []).map((w) => w.user_name));

    // ── 6. 提出状況を判定 ─────────────────────────────────────
    const absentUserIds = activeUserIds.filter((uid) => {
      const name = nameMap.get(uid);
      return !name || !submittedNames.has(name);
    });
    const presentUserIds = activeUserIds.filter((uid) => !absentUserIds.includes(uid));

    log.push(
      `[${squad.name}] メンバー${activeUserIds.length}人 / ` +
        `提出${presentUserIds.length}人 / 未提出${absentUserIds.length}人`
    );

    // ── 7. フリーズ判定：未提出者のうちフリーズ発動者を分離 ────
    const realAbsentIds: string[] = [];
    for (const uid of absentUserIds) {
      const name = nameMap.get(uid) ?? uid.slice(0, 8);
      const userChallenges = activeChallenges.filter((c) => c.user_id === uid);
      const hasFreezeActive = userChallenges.some((c) => c.freeze_active);

      if (hasFreezeActive) {
        // フリーズ消費：処刑スキップ
        for (const c of userChallenges) {
          if (c.freeze_active) {
            await supabaseAdmin
              .from("challenges")
              .update({ freeze_active: false, freeze_consumed_at: new Date().toISOString() })
              .eq("id", c.id);
          }
        }
        log.push(`    [${name}] ❄️ フリーズ発動！処刑スキップ`);
      } else {
        realAbsentIds.push(uid);
      }
    }

    // フリーズで全員セーフの場合は全員提出扱い
    const allSafe = realAbsentIds.length === 0;

    if (allSafe) {
      // ── 8a. 全員提出（orフリーズ）→ ストリーク +1 ────────────
      const newStreak = (squad.current_streak ?? 0) + 1;
      await supabaseAdmin
        .from("squads")
        .update({ current_streak: newStreak })
        .eq("id", squad.id);

      log.push(`  → ✅ 全員セーフ！streak ${squad.current_streak} → ${newStreak}`);
      results.push({ squad: squad.name, result: "streak_up", streak: newStreak });
    } else {
      // ── 8b. 戦犯あり → ストリークリセット ──────────────────
      await supabaseAdmin
        .from("squads")
        .update({ current_streak: 0 })
        .eq("id", squad.id);

      log.push(`  → ⚠️ 戦犯あり。streak ${squad.current_streak} → 0`);

      // ── 8c. 戦犯（未提出者）→ Capture（没収）+ failed ────────
      for (const uid of realAbsentIds) {
        const name = nameMap.get(uid) ?? uid.slice(0, 8);
        const userChallenges = activeChallenges.filter((c) => c.user_id === uid);

        await supabaseAdmin
          .from("challenges")
          .update({ status: "failed" })
          .eq("user_id", uid)
          .eq("status", "active");

        for (const c of userChallenges) {
          await captureDeposit(c.stripe_payment_intent_id, c.deposit_amount, uid, log, name);
        }
        log.push(`    [${name}] ❌ 戦犯！チャレンジ failed、デポジット没収`);
      }

      // ── 8d. 生存者（提出済み）→ Cancel（返金）+ failed ────────
      for (const uid of presentUserIds) {
        const name = nameMap.get(uid) ?? uid.slice(0, 8);
        const userChallenges = activeChallenges.filter((c) => c.user_id === uid);

        await supabaseAdmin
          .from("challenges")
          .update({ status: "failed" })
          .eq("user_id", uid)
          .eq("status", "active");

        for (const c of userChallenges) {
          await cancelDeposit(c.stripe_payment_intent_id, c.deposit_amount, uid, log, name);
        }
        log.push(`    [${name}] 🔓 生存者！チャレンジ failed（連帯責任）、デポジット返金`);
      }

      results.push({
        squad: squad.name,
        result: "streak_reset",
        criminals: realAbsentIds.map((uid) => nameMap.get(uid) ?? uid.slice(0, 8)),
        survivors: presentUserIds.map((uid) => nameMap.get(uid) ?? uid.slice(0, 8)),
      });
    }
  }

  log.push("judge 完了");
  console.log(log.join("\n"));

  return NextResponse.json({ ok: true, log, results });
}
