import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FREEZE_AMOUNT = 500;

export async function POST(req: NextRequest) {
  try {
    const { challengeId, userId, paymentIntentId } = await req.json();
    if (!challengeId || !userId || !paymentIntentId) {
      return NextResponse.json({ error: "challengeId, userId, paymentIntentId は必須" }, { status: 400 });
    }

    // freeze_active を true に更新
    const { error: updateErr } = await supabaseAdmin
      .from("challenges")
      .update({ freeze_active: true })
      .eq("id", challengeId)
      .eq("user_id", userId)
      .eq("status", "active");

    if (updateErr) throw updateErr;

    // transactions に記録
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      amount: FREEZE_AMOUNT,
      transaction_type: "freeze",
      stripe_charge_id: paymentIntentId,
    });

    console.log("[confirm-freeze] フリーズ有効化:", { challengeId, userId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[confirm-freeze]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
