"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/client/api";
import { useEvent } from "./EventProvider";

export function Nav() {
  const { snap, offline, pending } = useEvent();
  const path = usePathname();
  const slug = snap.event.slug;
  const tabs = [
    { href: `/e/${slug}/live`, label: "Live" },
    { href: `/e/${slug}/needs`, label: "Index" },
    { href: `/e/${slug}/me`, label: "My Need" },
    ...(snap.viewer.isAdminEmail ? [{ href: `/e/${slug}/admin`, label: "Admin" }] : []),
  ];
  async function signOut() {
    const r = await api<{ next: string }>(`/api/e/${slug}/auth/logout`, {});
    window.location.href = r.next;
  }
  return (
    <div className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
      {(offline || pending > 0) && (
        <div role="status" className="bg-amber-100 px-4 py-1.5 text-center text-sm text-amber-900">
          {offline ? "You're offline. " : ""}
          {pending > 0 ? `${pending} change${pending === 1 ? "" : "s"} will save when you reconnect.` : "Changes will save when you reconnect."}
        </div>
      )}
      <nav className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-2" aria-label="Main">
        {tabs.map((t) => {
          const active = path === t.href || path.startsWith(`${t.href}/`);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center whitespace-nowrap border-b-2 px-3 font-semibold ${active ? "border-crimson text-crimson" : "border-transparent text-gray-600 hover:text-gray-900"}`}>
              {t.label}
            </Link>
          );
        })}
        <div className="ml-auto flex items-center gap-2 pl-2">
          <span className="hidden max-w-40 truncate text-sm text-gray-500 sm:inline">{snap.viewer.name}</span>
          <button type="button" onClick={signOut} className="min-h-11 whitespace-nowrap px-2 text-sm font-medium text-gray-600 hover:text-crimson">
            Sign out
          </button>
        </div>
      </nav>
    </div>
  );
}
