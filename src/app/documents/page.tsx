"use client";

import { FileText, FolderOpen } from "lucide-react";

const LOCAL_DOCS = [
  {
    group: "Closing",
    items: [
      "LENDER FINAL CD.pdf — sale $885k, loan $840,750, cash to close $53,917.89",
      "Ade Advisor / attorney invoices",
      "Sublease 16 Weldon.pdf",
    ],
  },
  {
    group: "Bank statements",
    items: [
      "Chase + Prime — materials & furniture (split 60/20/20 → 1R/1L/2R)",
      "BoA — Zelle contractors, utilities, 1L rent (Ariel)",
      "BlueVine — 2L Apartments.com + 2R Airbnb",
    ],
  },
  {
    group: "Payee aliases",
    items: [
      "James = Artway Contractors LLC (reno labor via BoA Zelle)",
      "Israel = Is A Realtor / Israel Adeyanju (mgmt + some unit work)",
      "Ariel Y Blanca = 1L rent via Zelle → BoA",
    ],
  },
  {
    group: "Renovation proofs",
    items: [
      "Screenshots (WhatsApp Apr–May 2026)",
      "eReceipt.pdf / INV0458.pdf / Shruthi invoice.pdf",
    ],
  },
];

export default function DocumentsPage() {
  return (
    <main className="app-shell px-4 pb-8 pt-6">
      <header className="animate-rise">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
          Paper trail
        </p>
        <h1 className="display text-3xl font-semibold">Documents</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Your source files live in <code className="text-[var(--accent)]">C:\Users\ranji\luris-bnb-app</code>.
          Cloud upload unlocks when Supabase Storage is connected.
        </p>
      </header>

      <section className="panel animate-fade mt-5 p-4">
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <FolderOpen size={18} />
          <h2 className="font-semibold">Local library checklist</h2>
        </div>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          Use this as a map while you enter amounts. In Phase 2 with Supabase, attach PDFs
          directly to each transaction.
        </p>
      </section>

      <section className="stagger mt-4 space-y-3">
        {LOCAL_DOCS.map((group) => (
          <article key={group.group} className="panel animate-fade p-4">
            <h3 className="display text-lg font-semibold">{group.group}</h3>
            <ul className="mt-3 space-y-2">
              {group.items.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-[var(--ink-muted)]">
                  <FileText size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}
