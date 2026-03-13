import { NextResponse } from "next/server";

// Firebase 公式 CDN バージョンと一致させる
const FB_VER = "12.10.0";

export async function GET() {
  const config = JSON.stringify({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });

  const sw = `
importScripts('https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/${FB_VER}/firebase-messaging-compat.js');

firebase.initializeApp(${config});
const messaging = firebase.messaging();

// バックグラウンド通知
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'Streak Squad';
  const options = {
    body: payload.notification?.body ?? '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'poke',
    renotify: true,
    data: { url: payload.fcmOptions?.link ?? '/squad' },
  };
  self.registration.showNotification(title, options);
});

// 通知タップでアプリを開く
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/squad';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
`.trim();

  return new NextResponse(sw, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      // キャッシュしない（設定変更がすぐ反映されるように）
      "Cache-Control": "no-store",
    },
  });
}
