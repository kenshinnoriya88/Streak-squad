"use client";

import { useEffect, useState } from "react";

export type PushStatus =
  | "idle"
  | "unsupported"   // ブラウザが非対応
  | "ios_browser"   // iOS Safari（ホーム画面追加が必要）
  | "denied"        // 許可拒否
  | "subscribing"   // 登録中
  | "subscribed"    // 登録済み
  | "error";        // 登録失敗

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer;
}

export function usePushNotification(userId: string | undefined) {
  const [status, setStatus] = useState<PushStatus>("idle");

  useEffect(() => {
    if (!userId) return;

    // iOS Safari（ホーム画面 PWA 以外）は非対応
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isIOS && !isStandalone) {
      console.warn("[Push] iOS Safari 通常ブラウザは非対応。ホーム画面に追加してください。");
      setStatus("ios_browser");
      return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("[Push] このブラウザはプッシュ通知未対応");
      setStatus("unsupported");
      return;
    }

    const register = async () => {
      setStatus("subscribing");
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus("denied");
          return;
        }

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
              process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
            ),
          });
        }

        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, subscription }),
        });

        if (!res.ok) throw new Error(`API ${res.status}`);
        setStatus("subscribed");
        console.log("[Push] 登録成功");
      } catch (err) {
        console.error("[Push] 登録エラー:", err);
        setStatus("error");
      }
    };

    register();
  }, [userId]);

  return status;
}
