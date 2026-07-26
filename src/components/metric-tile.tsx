"use client";

import { formatCurrency } from "@/lib/calculations";
import { cn } from "@/lib/cn";

export function MetricTile({
  label,
  value,
  hint,
  tone = "default",
  featured = false,
  className,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "accent";
  featured?: boolean;
  className?: string;
}) {
  const display = typeof value === "number" ? formatCurrency(value) : value;
  return (
    <div
      className={cn(
        "metric-tile panel p-4 animate-fade",
        featured && "featured",
        className
      )}
    >
      <p className="metric-label text-[0.7rem] font-semibold uppercase tracking-[0.08em]">
        {label}
      </p>
      <p
        className={cn(
          "display mt-1.5 font-semibold leading-none tracking-tight",
          featured ? "text-[2.35rem]" : "text-2xl",
          !featured && tone === "good" && "text-[var(--good)]",
          !featured && tone === "warn" && "text-[var(--warn)]",
          !featured && tone === "accent" && "text-[var(--accent)]",
          featured && tone === "good" && "text-[#9fd4e0]",
          featured && tone === "warn" && "text-[#f0c9a0]"
        )}
      >
        {display}
      </p>
      {hint ? (
        <p className={cn("metric-hint mt-2 text-xs leading-snug", !featured && "text-[var(--ink-muted)]")}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
