"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Compare", href: "/compare" },
  { label: "Platforms", href: "/platforms" },
  { label: "Eval Report", href: "/eval-report" },
  { label: "Vendor Eval", href: "/vendor-eval" },
  { label: "Demo", href: "/demo" },
  { label: "Artifacts", href: "/artifacts" },
  { label: "Pricing", href: "/pricing" },
  { label: "Calculator", href: "/calculator" },
  { label: "Docs", href: "/docs/integrations" },
];

export default function NavHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (searchParams.get("embed") === "true") return null;

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1.5rem",
        padding: "0.75rem 1.5rem",
        borderBottom: "1px solid #222",
        backgroundColor: "#0a0a0a",
        fontSize: "0.85rem",
      }}
    >
      <span
        style={{
          fontWeight: 700,
          fontSize: "1rem",
          color: "#e5e5e5",
          marginRight: "1rem",
        }}
      >
        Agora
      </span>
      {NAV_ITEMS.map(({ label, href }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            style={{
              color: isActive ? "#fff" : "#666",
              textDecoration: "none",
              borderBottom: isActive ? "1px solid #fff" : "1px solid transparent",
              paddingBottom: "2px",
              transition: "color 0.15s",
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
