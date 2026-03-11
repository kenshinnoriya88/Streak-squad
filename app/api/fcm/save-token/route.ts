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

    // まず update を試行、行がなければ upsert
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ fcm_token: token })
      .eq("id", userId);

    if (updateError) {
      console.warn("[fcm/save-token] update失敗、upsert試行:", JSON.stringify(updateError));
      const { error: upsertError } = await supabaseAdmin
        .from("profiles")
        .upsert({ id: userId, fcm_token: token }, { onConflict: "id" });
      if (upsertError) {
        console.error("[fcm/save-token] upsert失敗:", JSON.stringify(upsertError));
        throw new Error(JSON.stringify(upsertError));
      }
    }

    console.log("[fcm/save-token] 保存成功 userId:", userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[fcm/save-token] エラー:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
