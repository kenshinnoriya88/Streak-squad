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

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isIOS && !isStandalone) {
      console.log("[FCM] iOS ブラウザ（PWA未追加）を検出");
      setStatus("ios_browser");
      return;
    }

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      console.log("[FCM] Notification API 未対応ブラウザ");
      setStatus("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      console.log("[FCM] 通知が拒否されている");
      setStatus("denied");
      return;
    }

    if (Notification.permission === "default") {
      console.log("[FCM] 通知許可が未回答 → モーダルへ");
      setStatus("need_permission");
      return;
    }

    // granted → Token 取得へ
    console.log("[FCM] 通知許可済み → Token 取得開始");
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
    console.log("[FCM] Messaging 初期化...");
    const messaging = getFirebaseMessaging();
    if (!messaging) throw new Error("Messaging 未初期化（SSR?）");

    console.log("[FCM] Service Worker 登録...");
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );
    await navigator.serviceWorker.ready;
    console.log("[FCM] Service Worker 準備完了");

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    console.log("[FCM] VAPID Key:", vapidKey ? `${vapidKey.slice(0, 10)}...` : "未設定!");

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) throw new Error("Token 取得失敗（空）");
    console.log("[FCM] Token 取得成功:", token.slice(0, 20) + "...");

    const res = await fetch("/api/fcm/save-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, token }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`save-token API ${res.status}: ${JSON.stringify(body)}`);
    }

    setStatus?.("subscribed");
    console.log("[FCM] 登録完了!");
  } catch (err) {
    console.error("[FCM] 登録エラー:", err);
    setStatus?.("error");
  }
}
