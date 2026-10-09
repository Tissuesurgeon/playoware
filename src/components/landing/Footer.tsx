import Link from "next/link";

const links = [
  { href: "/play", label: "Play" },
  { href: "/learn", label: "Learn" },
  { href: "/history", label: "History" },
  { href: "/profile", label: "Profile" },
];

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-serif text-xl">
          PlayOware
          <span className="mt-1 block font-sans text-sm font-normal text-ink-soft">Online, or against the computer.</span>
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-ink-soft">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
