import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── 認証チェック ──────────────────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  // Vercel Cron は Authorization: Bearer <secret> を送る
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  // ローカルテスト用: ?secret=xxx も受け付ける
  const urlSecret = new URL(req.url).searchParams.get("secret");
  return urlSecret === secret;
}

// ── JST での「昨日」の UTC 範囲を返す ─────────────────────────
function yesterdayJSTinUTC(): { start: Date; end: Date } {
  const nowUTC = new Date();
  // JST = UTC + 9h
  const nowJST = new Date(nowUTC.getTime() + 9 * 60 * 60 * 1000);
  // 昨日の JST 0:00
  const yStart = new Date(nowJST);
  yStart.setDate(yStart.getDate() - 1);
  yStart.setHours(0, 0, 0, 0);
  // 昨日の JST 23:59:59.999
  const yEnd = new Date(yStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  // UTC に戻す
  return {
    start: new Date(yStart.getTime() - 9 * 60 * 60 * 1000),
    end: new Date(yEnd.getTime() - 9 * 60 * 60 * 1000),
  };
}

// ── メインロジック ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { start: dayStart, end: dayEnd } = yesterdayJSTinUTC();
  const log: string[] = [];
  log.push(`judge 開始: 対象日 JST ${dayStart.toISOString()} 〜 ${dayEnd.toISOString()}`);

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
      .select("id, user_id")
      .in("user_id", memberIds)
      .eq("status", "active");

    if (!activeChallenges?.length) {
      log.push(`[${squad.name}] アクティブチャレンジなし → スキップ`);
      continue;
    }

    const activeUserIds = [...new Set(activeChallenges.map((c) => c.user_id as string))];

    // ── 4. display_name を解決（workouts は user_name で記録）──
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", activeUserIds);

    const nameMap = new Map<string, string>(); // userId → display_name
    (profiles ?? []).forEach((p) => {
      if (p.display_name) nameMap.set(p.id as string, p.display_name as string);
    });

    // ── 5. 昨日の workouts を取得 ──────────────────────────────
    const displayNames = [...nameMap.values()];
    const { data: yesterdayWorkouts } = displayNames.length
      ? await supabaseAdmin
          .from("workouts")
          .select("user_name")
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

    const allSubmitted = absentUserIds.length === 0;

    log.push(
      `[${squad.name}] メンバー${activeUserIds.length}人 / ` +
        `提出${submittedNames.size}人 / 未提出${absentUserIds.length}人`
    );

    if (allSubmitted) {
      // ── 7a. 全員提出 → ストリーク +1 ─────────────────────────
      const newStreak = (squad.current_streak ?? 0) + 1;
      await supabaseAdmin
        .from("squads")
        .update({ current_streak: newStreak })
        .eq("id", squad.id);

      log.push(`  → ✅ 全員提出！streak ${squad.current_streak} → ${newStreak}`);
      results.push({ squad: squad.name, result: "streak_up", streak: newStreak });
    } else {
      // ── 7b. 誰か未提出 → ストリークリセット ──────────────────
      await supabaseAdmin
        .from("squads")
        .update({ current_streak: 0 })
        .eq("id", squad.id);

      log.push(`  → ⚠️ 未提出者あり。streak ${squad.current_streak} → 0`);

      // ── 7c. 未提出者のチャレンジを failed に ──────────────────
      for (const uid of absentUserIds) {
        const name = nameMap.get(uid) ?? uid.slice(0, 8);

        const { data: updated, error: updateErr } = await supabaseAdmin
          .from("challenges")
          .update({ status: "failed" })
          .eq("user_id", uid)
          .eq("status", "active")
          .select("id, deposit_amount, stripe_payment_intent_id");

        if (updateErr) {
          log.push(`    [${name}] challenge 更新エラー: ${updateErr.message}`);
        } else {
          log.push(
            `    [${name}] ❌ challenge failed: ${(updated ?? [])
              .map((c) => `id=${c.id} ¥${c.deposit_amount}`)
              .join(", ")}`
          );
        }
      }

      results.push({
        squad: squad.name,
        result: "streak_reset",
        absent: absentUserIds.map((uid) => nameMap.get(uid) ?? uid.slice(0, 8)),
      });
    }
  }

  log.push("judge 完了");
  console.log(log.join("\n"));

  return NextResponse.json({ ok: true, log, results });
}
