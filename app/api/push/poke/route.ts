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

    // FCM token を profiles から取得
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("fcm_token")
      .eq("id", toUserId)
      .maybeSingle();

    if (error) {
      console.error("[poke] DB エラー:", JSON.stringify(error));
      throw error;
    }

    const fcmToken = data?.fcm_token;
    if (!fcmToken) {
      console.warn("[poke] FCM token なし → 通知スキップ");
      return NextResponse.json({ ok: true, sent: false, reason: "no_token" });
    }

    console.log("[poke] FCM token:", fcmToken.slice(0, 20) + "...");

    // FCM で送信
    const admin = getAdmin();
    const messageId = await admin.messaging().send({
      token: fcmToken,
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

    console.log("[poke] FCM 送信完了 messageId:", messageId);
    return NextResponse.json({ ok: true, sent: true, messageId });
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    const code = (err as Record<string, unknown>)?.code;
    console.error("[poke] エラー:", message, "code:", code);
    return NextResponse.json({ error: message, code }, { status: 500 });
  }
}
