import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId, subscription } = await req.json();
    console.log("[push/subscribe] userId:", userId, "endpoint:", subscription?.endpoint?.slice(0, 60));

    if (!userId || !subscription) {
      return NextResponse.json({ error: "userId と subscription は必須です" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert({ user_id: userId, subscription }, { onConflict: "user_id" });

    if (error) {
      console.error("[push/subscribe] DB error:", error);
      throw error;
    }

    console.log("[push/subscribe] 登録成功 userId:", userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push/subscribe] exception:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
