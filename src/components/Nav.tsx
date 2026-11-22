import Link from "next/link";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export async function Nav() {
  await connection();
  const pending = db.select().from(schema.approvals).where(eq(schema.approvals.status, "pending")).all().length;
  const unread = db.select().from(schema.notifications).where(eq(schema.notifications.read, false)).all().length;

  const links: Array<{ href: string; label: string; badge?: number }> = [
    { href: "/", label: "Dashboard" },
    { href: "/approvals", label: "Approvals", badge: pending },
    { href: "/marketplace", label: "Marketplace" },
    { href: "/receipts", label: "Receipts" },
    { href: "/inbox", label: "Inbox", badge: unread },
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-leaf text-sm font-bold text-white">Ọ</span>
          <span className="font-semibold tracking-tight">
            Ọjà <span className="hidden font-normal text-ink-2 sm:inline">Agent Studio</span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 overflow-x-auto text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-ink-2 hover:bg-paper-2 hover:text-ink">
              {l.label}
              {l.badge ? <span className="pill bg-gold text-white">{l.badge}</span> : null}
            </Link>
          ))}
          <Link href="/agents/new" className="btn-primary ml-2 whitespace-nowrap py-1.5">
            + New agent
          </Link>
        </nav>
      </div>
    </header>
  );
}
