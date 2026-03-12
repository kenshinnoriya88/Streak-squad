import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdmin } from "@/lib/firebase-admin";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { toUserId, fromName } = await req.json();
    if (!toUserId || !fromName) {
      return NextResponse.json({ error: "toUserId と fromName は必須" }, { status: 400 });
    }

    console.log("[poke] toUserId:", toUserId, "fromName:", fromName);

    // 全デバイスの FCM token を取得
    const { data: tokens, error } = await supabaseAdmin
      .from("fcm_tokens")
      .select("id, token")
      .eq("user_id", toUserId);

    if (error) {
      console.error("[poke] DB エラー:", JSON.stringify(error));
      throw error;
    }

    if (!tokens || tokens.length === 0) {
      console.warn("[poke] FCM token なし → 通知スキップ");
      return NextResponse.json({ ok: true, sent: false, reason: "no_token" });
    }

    console.log("[poke] 送信先デバイス数:", tokens.length);

    // 全デバイスに送信（失敗したトークンは削除）
    const admin = getAdmin();
    const results: { token: string; success: boolean; messageId?: string }[] = [];
    const staleTokenIds: string[] = [];

    for (const { id, token } of tokens) {
      try {
        const messageId = await admin.messaging().send({
          token,
          notification: {
            title: "👊 Poke！さぼってんじゃない！",
            body: `${fromName} があなたをPokeしました！記録を止めるな！`,
          },
          webpush: {
            fcmOptions: { link: "/squad" },
            notification: {
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              tag: "poke",
              renotify: true,
            },
          },
        });
        console.log("[poke] 送信成功 token:", token.slice(0, 20) + "... messageId:", messageId);
        results.push({ token: token.slice(0, 20), success: true, messageId });
      } catch (sendErr) {
        const code = (sendErr as Record<string, unknown>)?.code;
        console.warn("[poke] 送信失敗 token:", token.slice(0, 20) + "... code:", code);
        results.push({ token: token.slice(0, 20), success: false });

        // 無効なトークンは削除対象
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          staleTokenIds.push(id);
        }
      }
    }

    // 無効トークンを削除
    if (staleTokenIds.length > 0) {
      await supabaseAdmin.from("fcm_tokens").delete().in("id", staleTokenIds);
      console.log("[poke] 無効トークン削除:", staleTokenIds.length, "件");
    }

    const sentCount = results.filter((r) => r.success).length;
    return NextResponse.json({
      ok: true,
      sent: sentCount > 0,
      sentCount,
      totalDevices: tokens.length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    const code = (err as Record<string, unknown>)?.code;
    console.error("[poke] エラー:", message, "code:", code);
    return NextResponse.json({ error: message, code }, { status: 500 });
  }
}
