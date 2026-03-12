import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId, token } = await req.json();
    if (!userId || !token) {
      return NextResponse.json({ error: "userId と token は必須" }, { status: 400 });
    }

    // fcm_tokens テーブルに upsert（同じuser_id+tokenなら updated_at を更新）
    const { error } = await supabaseAdmin
      .from("fcm_tokens")
      .upsert(
        { user_id: userId, token, updated_at: new Date().toISOString() },
        { onConflict: "user_id,token" }
      );

    if (error) {
      console.error("[fcm/save-token] upsert失敗:", JSON.stringify(error));
      throw new Error(JSON.stringify(error));
    }

    console.log("[fcm/save-token] 保存成功 userId:", userId, "token:", token.slice(0, 20) + "...");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[fcm/save-token] エラー:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
