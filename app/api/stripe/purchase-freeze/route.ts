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

const FREEZE_AMOUNT = 500; // 円

export async function POST(req: NextRequest) {
  try {
    const { challengeId, userId } = await req.json();
    if (!challengeId || !userId) {
      return NextResponse.json({ error: "challengeId と userId は必須" }, { status: 400 });
    }

    // チャレンジの存在確認
    const { data: challenge, error: findErr } = await supabaseAdmin
      .from("challenges")
      .select("id, user_id, status, freeze_active")
      .eq("id", challengeId)
      .eq("user_id", userId)
      .single();

    if (findErr || !challenge) {
      return NextResponse.json({ error: "チャレンジが見つかりません" }, { status: 404 });
    }
    if (challenge.status !== "active") {
      return NextResponse.json({ error: "アクティブなチャレンジのみフリーズ可能です" }, { status: 400 });
    }
    if (challenge.freeze_active) {
      return NextResponse.json({ error: "既にフリーズが有効です" }, { status: 400 });
    }

    // Stripe 即時決済（PaymentIntentをclient_secretで返す）
    const paymentIntent = await stripe.paymentIntents.create({
      amount: FREEZE_AMOUNT,
      currency: "jpy",
      capture_method: "automatic", // 即時決済
      metadata: {
        userId,
        challengeId,
        type: "freeze_purchase",
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: FREEZE_AMOUNT,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[purchase-freeze]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
