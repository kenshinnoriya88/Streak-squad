"use client";

import { useEffect, useState } from "react";
import { getToken } from "firebase/messaging";
import { getFirebaseMessaging } from "@/lib/firebase";

export type FCMStatus =
  | "idle"
  | "ios_browser"   // iOS Safari（ホーム画面未追加）
  | "unsupported"   // ブラウザ非対応
  | "need_permission" // まだ許可ダイアログを出していない
  | "denied"        // 拒否済み
  | "subscribing"   // 取得中
  | "subscribed"    // 登録済み
  | "error";

export function useFCMToken(userId: string | undefined) {
  const [status, setStatus] = useState<FCMStatus>("idle");

  useEffect(() => {
    if (!userId) return;

    // iOS Safari（PWA でない場合）
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isChrome = /CriOS/.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    // iOS Chrome は PWA でも Push 非対応
    if (isIOS && isChrome) {
      setStatus("unsupported");
      return;
    }
    if (isIOS && !isStandalone) {
      setStatus("ios_browser");
      return;
    }

    if (!("Notification" in window)) {
      setStatus("unsupported");
      return;
    }

    // 既に許可 or 拒否されていたら許可ダイアログをスキップ
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    // default（未回答）ならモーダルに委ねる
    if (Notification.permission === "default") {
      setStatus("need_permission");
      return;
    }

    // granted → そのまま Token 取得へ
    registerToken(userId, setStatus);
  }, [userId]);

  return status;
}

export async function registerToken(
  userId: string,
  setStatus?: (s: FCMStatus) => void
) {
  setStatus?.("subscribing");
  try {
    const messaging = getFirebaseMessaging();
    if (!messaging) throw new Error("Messaging 未初期化");

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );
    await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) throw new Error("Token 取得失敗（空）");

    const res = await fetch("/api/fcm/save-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, token }),
    });
    if (!res.ok) throw new Error(`save-token API ${res.status}`);

    setStatus?.("subscribed");
    console.log("[FCM] 登録完了:", token.slice(0, 20) + "...");
  } catch (err) {
    console.error("[FCM] 登録エラー:", err);
    setStatus?.("error");
  }
}
