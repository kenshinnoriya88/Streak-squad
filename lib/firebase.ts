import { getApps, initializeApp } from "firebase/app";
import { getMessaging, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// シングルトン
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Messaging はブラウザ専用なので遅延取得
let messaging: Messaging | null = null;
export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === "undefined") return null;
  if (!messaging) messaging = getMessaging(app);
  return messaging;
}
