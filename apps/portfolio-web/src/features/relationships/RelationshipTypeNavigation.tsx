"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
export function RelationshipTypeNavigation() {
  const params = useSearchParams();
  const path = usePathname();
  const government = params.get("kind") === "government";
  function href(kind: string) {
    const next = new URLSearchParams(params);
    next.set("kind", kind);
    next.delete("person");
    next.delete("target");
    return `${path}?${next}`;
  }
  return (
    <nav className="row" aria-label="Relationship type">
      <Link
        className="button"
        aria-current={!government ? "page" : undefined}
        href={href("organization")}
      >
        Organization
      </Link>
      <Link
        className="button"
        aria-current={government ? "page" : undefined}
        href={href("government")}
      >
        Government relationships
      </Link>
    </nav>
  );
}
