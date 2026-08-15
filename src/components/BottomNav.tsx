"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const ITEMS = [
  { href: "/my-songs", label: "My Songs", icon: "♪" },
  { href: "/search", label: "Search", icon: "🔍" },
  { href: "/playlists", label: "Playlists", icon: "☰" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-stretch">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium ${
                active ? "text-emerald-400" : "text-neutral-400"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium text-neutral-400"
        >
          <span className="text-lg leading-none">&#x23FB;</span>
          Log out
        </button>
      </div>
    </nav>
  );
}
