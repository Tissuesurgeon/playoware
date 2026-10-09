"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { readActiveGameId } from "@/lib/storage";

const links = [
  { href: "/play", label: "Play" },
  { href: "/learn", label: "Learn" },
  { href: "/history", label: "History" },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const bare = pathname.startsWith("/game") || pathname.startsWith("/match") || pathname.startsWith("/review") || pathname.startsWith("/dev");

  function guard(href: string) {
    if (pathname.startsWith("/match/")) {
      setPending(href);
      setOpen(false);
      return false;
    }
    if (!pathname.startsWith("/game/") || !readActiveGameId()) {
      setOpen(false);
      return true;
    }
    setPending(href);
    setOpen(false);
    return false;
  }

  return (
    <>
      {bare ? null : (
        <header className="border-b border-line bg-cream/90">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
            <Link href="/" className="font-serif text-2xl tracking-tight">
              PlayOware
            </Link>
            <nav className="hidden items-center gap-6 text-sm font-semibold md:flex" aria-label="Main">
              {links.map((link) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={active ? "text-forest" : "text-ink-soft hover:text-ink"}
                    onClick={(event) => {
                      if (!guard(link.href)) event.preventDefault();
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <div className="hidden items-center gap-4 text-sm font-semibold md:flex">
              <Link
                href="/profile"
                aria-current={pathname.startsWith("/profile") ? "page" : undefined}
                className={pathname.startsWith("/profile") ? "text-forest" : "text-ink-soft hover:text-ink"}
                onClick={(event) => !guard("/profile") && event.preventDefault()}
              >
                Profile
              </Link>
              <Link href="/settings" className="text-ink-soft hover:text-ink" onClick={(event) => !guard("/settings") && event.preventDefault()}>
                Settings
              </Link>
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <Link href="/play" className="inline-flex h-11 items-center rounded-full bg-forest px-4 text-sm font-semibold text-paper hover:bg-forest-dark">
                Play
              </Link>
              <button
                type="button"
                className="h-11 rounded-full border border-line px-4 text-sm font-semibold"
                aria-expanded={open}
                aria-controls="mobile-nav"
                onClick={() => setOpen((value) => !value)}
              >
                Menu
              </button>
            </div>
          </div>
          {open ? (
            <nav id="mobile-nav" className="flex flex-col gap-1 border-t border-line px-4 py-3 md:hidden" aria-label="Mobile">
              {[...links, { href: "/profile", label: "Profile" }, { href: "/settings", label: "Settings" }].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl px-3 py-3 text-sm font-semibold"
                  onClick={(event) => {
                    if (!guard(link.href)) event.preventDefault();
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </header>
      )}
      {children}
      {pending ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="leave-title">
          <div className="w-full max-w-sm rounded-3xl bg-paper p-6 shadow-xl">
            <h2 id="leave-title" className="font-serif text-2xl">
              Leave this game?
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              {pathname.startsWith("/match/")
                ? "The match stays open for your opponent. You can rejoin from home."
                : "The game stays on this device until it ends. You can resume it from the home page."}
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setPending(null)}>
                Stay
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  const href = pending;
                  setPending(null);
                  router.push(href);
                }}
              >
                Leave
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
