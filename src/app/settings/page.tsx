"use client";

import { useState } from "react";
import Link from "next/link";
import { useData } from "@/lib/data-context";
import { formatCurrency } from "@/lib/calculations";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function SettingsPage() {
  const {
    property,
    partnerName,
    setPartnerName,
    units,
    updateUnit,
    mode,
    user,
    signInWithEmail,
    signOut,
    claimCloudProperty,
    invitePartner,
    refreshCloud,
    cloudMessage,
  } = useData();
  const supabaseReady = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const msg = await signInWithEmail(email);
      setStatus(msg);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function onClaim() {
    setBusy(true);
    setStatus(null);
    try {
      await claimCloudProperty();
      setStatus("Cloud property claimed — ledger synced.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  }

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await invitePartner(inviteEmail);
      setStatus(`Partner invite recorded for ${inviteEmail}.`);
      setInviteEmail("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell px-4 pb-8 pt-6">
      <header className="animate-rise">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
          Household
        </p>
        <h1 className="display text-3xl font-semibold">Settings</h1>
      </header>

      <section className="panel animate-fade mt-5 space-y-3 p-4">
        <h2 className="display text-lg font-semibold">Cloud sync (Supabase)</h2>
        <p className="text-sm text-[var(--ink-muted)]">
          Project <code>luris-bnb</code> · mode{" "}
          <strong className="text-[var(--ink)]">{mode}</strong>
          {supabaseReady ? " · configured" : " · env missing"}
        </p>
        {user ? (
          <div className="space-y-3 text-sm">
            <p>
              Signed in as <strong>{user.email}</strong>
            </p>
            {mode === "local" ? (
              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={busy}
                onClick={() => void onClaim()}
              >
                Claim property &amp; load shared ledger
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-ghost w-full"
                disabled={busy}
                onClick={() => void refreshCloud()}
              >
                Refresh from cloud
              </button>
            )}
            {mode === "cloud" ? (
              <form onSubmit={onInvite} className="space-y-2">
                <label className="field">
                  <span>Invite partner (must sign up first)</span>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="partner@email.com"
                  />
                </label>
                <button type="submit" className="btn btn-ghost w-full" disabled={busy}>
                  Add partner
                </button>
              </form>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost w-full"
              disabled={busy}
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          </div>
        ) : (
          <form onSubmit={onSignIn} className="space-y-3">
            <p className="text-sm text-[var(--ink-muted)]">
              Magic-link sign-in. First partner to claim becomes owner; the other is invited
              after they create an account.
            </p>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
              />
            </label>
            <button type="submit" className="btn btn-primary w-full" disabled={busy || !supabaseReady}>
              Send magic link
            </button>
          </form>
        )}
        {status || cloudMessage ? (
          <p className="text-sm text-[var(--accent)]">{status || cloudMessage}</p>
        ) : null}
      </section>

      <section className="panel animate-fade mt-4 space-y-3 p-4">
        <h2 className="display text-lg font-semibold">Property</h2>
        <Info label="Name" value={property.name} />
        <Info
          label="Address"
          value={`${property.address_line}, ${property.city}, ${property.state} ${property.zip}`}
        />
        <Info label="Closed" value={property.purchase_date} />
        <Info label="Sale price" value={formatCurrency(property.sale_price)} />
        <Info label="Loan" value={`${formatCurrency(property.loan_amount)} @ ${property.interest_rate}%`} />
        <Info label="Monthly PITI" value={formatCurrency(property.monthly_mortgage_total)} />
      </section>

      <section className="panel animate-fade mt-4 p-4">
        <h2 className="display text-lg font-semibold">Expected rents (projections)</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Used on the Ops page for future months. 1R stays $0 while under renovation.
        </p>
        <div className="mt-3 space-y-3">
          {units.map((u) => (
            <div key={u.id} className="field">
              <label>
                {u.code}
                {u.status === "under_renovation" ? " · under reno" : ""}
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={u.expected_monthly_rent}
                onChange={(e) =>
                  updateUnit(u.id, {
                    expected_monthly_rent: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
          ))}
        </div>
        <Link href="/ops" className="mt-3 inline-block text-sm text-[var(--accent)] underline">
          Open monthly ops →
        </Link>
      </section>

      <section className="panel animate-fade mt-4 p-4">
        <h2 className="display text-lg font-semibold">Gmail bills (PSE&amp;G + Veolia)</h2>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          Best path for automatic utility amounts: connect Gmail read-only, find PSE&amp;G and
          Veolia emails, parse the amount + due date, and create expense rows.
        </p>
        <button type="button" className="btn btn-ghost mt-3 w-full opacity-60" disabled>
          Connect Gmail (coming next)
        </button>
      </section>

      <section className="panel animate-fade mt-4 p-4">
        <h2 className="display text-lg font-semibold">Payee aliases</h2>
        <div className="mt-3 space-y-2 text-sm">
          <Info label="James" value="Artway Contractors LLC" />
          <Info label="Israel" value="Is A Realtor / Israel Adeyanju" />
          <Info label="Ariel" value="1L tenant — Zelle → BoA" />
        </div>
      </section>

      <section className="panel animate-fade mt-4 p-4">
        <h2 className="display text-lg font-semibold">Partners</h2>
        <div className="field mt-3">
          <label>Partner display name</label>
          <input
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
          />
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] py-2 text-sm last:border-0">
      <span className="text-[var(--ink-muted)]">{label}</span>
      <span className="max-w-[60%] text-right font-medium">{value}</span>
    </div>
  );
}
