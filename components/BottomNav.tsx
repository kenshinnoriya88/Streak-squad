"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const HIDDEN_PATHS = ["/login", "/auth/callback", "/challenges/new"];

const NAV_ITEMS = [
  { href: "/", label: "ホーム", icon: "🏠" },
  { href: "/squad", label: "スクワッド", icon: "👥" },
  { href: "/profile", label: "プロフィール", icon: "👤" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user || HIDDEN_PATHS.includes(pathname)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800/60 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 pb-safe">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-6 py-3 text-xs font-semibold transition-all duration-200 active:scale-90 ${
                isActive ? "text-red-400" : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              <span className={`text-xl ${isActive ? "drop-shadow-[0_0_6px_rgba(248,113,113,0.6)]" : ""}`}>
                {icon}
              </span>
              <span>{label}</span>
              {isActive && (
                <span className="mt-0.5 h-0.5 w-4 rounded-full bg-red-500" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
