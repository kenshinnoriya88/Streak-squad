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

    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, fcm_token: token }, { onConflict: "id" });

    if (error) throw error;

    console.log("[fcm/save-token] 保存成功 userId:", userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[fcm/save-token]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
