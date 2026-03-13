import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { XP_ACTIONS, calcLevel } from "@/lib/xp";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ActionKey = keyof typeof XP_ACTIONS;

export async function POST(req: NextRequest) {
  try {
    const { userId, action } = await req.json();
    if (!userId || !action) {
      return NextResponse.json({ error: "userId と action は必須" }, { status: 400 });
    }

    const amount = XP_ACTIONS[action as ActionKey];
    if (!amount) {
      return NextResponse.json({ error: `不明なアクション: ${action}` }, { status: 400 });
    }

    // アトミックにXPをインクリメント
    const { data, error } = await supabaseAdmin.rpc("increment_xp", {
      user_id_param: userId,
      amount_param: amount,
    });

    if (error) throw error;

    const newXp = data?.[0]?.new_xp ?? 0;
    const newLevel = calcLevel(newXp);
    const oldLevel = calcLevel(newXp - amount);
    const leveledUp = newLevel > oldLevel;

    // レベルが上がった場合はprofilesのlevelも更新
    if (leveledUp) {
      await supabaseAdmin
        .from("profiles")
        .update({ level: newLevel })
        .eq("id", userId);
    }

    return NextResponse.json({
      ok: true,
      xpGained: amount,
      totalXp: newXp,
      level: newLevel,
      leveledUp,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[xp/grant]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
