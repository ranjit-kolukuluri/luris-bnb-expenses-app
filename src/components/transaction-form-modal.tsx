"use client";

import { useEffect, useState } from "react";
import { PAYMENT_ACCOUNTS } from "@/lib/seed";
import type { Cadence, Category, Transaction, TransactionType, Unit } from "@/lib/types";

const empty = {
  title: "",
  description: "",
  amount: "",
  occurred_on: new Date().toISOString().slice(0, 10),
  applies_on: "",
  type: "expense" as TransactionType,
  cadence: "one_time" as Cadence,
  category_id: "",
  unit_id: "",
  payment_account: "",
  vendor: "",
};

function monthStart(date: string) {
  return date ? `${date.slice(0, 7)}-01` : "";
}

export function TransactionFormModal({
  open,
  onClose,
  onSave,
  onDelete,
  initial,
  categories,
  units,
  defaultType,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<Transaction, "id" | "property_id" | "is_seeded"> & { id?: string }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  initial?: Transaction | null;
  categories: Category[];
  units: Unit[];
  defaultType?: TransactionType;
}) {
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        title: initial.title,
        description: initial.description ?? "",
        amount: String(initial.amount),
        occurred_on: initial.occurred_on,
        applies_on: initial.applies_on ?? monthStart(initial.occurred_on),
        type: initial.type,
        cadence: initial.cadence,
        category_id: initial.category_id ?? "",
        unit_id: initial.unit_id ?? "",
        payment_account: initial.payment_account ?? "",
        vendor: initial.vendor ?? "",
      });
    } else {
      const type = defaultType ?? "expense";
      const cats = categories.filter((c) => c.kind === type);
      const occurred = empty.occurred_on;
      setForm({
        ...empty,
        type,
        category_id: cats[0]?.id ?? "",
        cadence: cats[0]?.cadence ?? "one_time",
        applies_on: type === "income" ? monthStart(occurred) : "",
      });
    }
  }, [open, initial, defaultType, categories]);

  if (!open) return null;

  const filteredCats = categories.filter((c) => c.kind === form.type);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.title.trim() || Number.isNaN(amount)) return;
    try {
      await onSave({
        id: initial?.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        amount,
        occurred_on: form.occurred_on,
        applies_on:
          form.type === "income"
            ? form.applies_on || monthStart(form.occurred_on) || null
            : form.applies_on || null,
        type: form.type,
        cadence: form.cadence,
        category_id: form.category_id || null,
        unit_id: form.unit_id || null,
        payment_account: form.payment_account || null,
        vendor: form.vendor.trim() || null,
      });
      onClose();
    } catch (err) {
      // Error is already handled in parent component
      console.error("Error saving transaction:", err);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 p-3 sm:items-center">
      <form
        onSubmit={submit}
        className="panel animate-rise w-full max-w-md max-h-[90dvh] overflow-y-auto p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-xl font-semibold">
            {initial ? "Edit entry" : "Add entry"}
          </h2>
          <button type="button" className="btn btn-ghost px-3 py-1 text-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="field">
              <label>Type</label>
              <select
                value={form.type}
                onChange={(e) => {
                  const type = e.target.value as TransactionType;
                  const cats = categories.filter((c) => c.kind === type);
                  setForm((f) => ({
                    ...f,
                    type,
                    category_id: cats[0]?.id ?? "",
                    cadence: cats[0]?.cadence ?? f.cadence,
                  }));
                }}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div className="field">
              <label>Cadence</label>
              <select
                value={form.cadence}
                onChange={(e) => setForm((f) => ({ ...f, cadence: e.target.value as Cadence }))}
              >
                <option value="one_time">One-time</option>
                <option value="recurring">Recurring</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Title</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Water bill — March"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="field">
              <label>Amount</label>
              <input
                required
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="field">
              <label>{form.type === "income" ? "Received" : "Date"}</label>
              <input
                type="date"
                required
                value={form.occurred_on}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    occurred_on: e.target.value,
                    applies_on:
                      f.type === "income" && !f.applies_on
                        ? monthStart(e.target.value)
                        : f.applies_on || monthStart(e.target.value),
                  }))
                }
              />
            </div>
          </div>

          {form.type === "income" ? (
            <div className="field">
              <label>Applies to month</label>
              <input
                type="month"
                value={form.applies_on ? form.applies_on.slice(0, 7) : form.occurred_on.slice(0, 7)}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    applies_on: e.target.value ? `${e.target.value}-01` : "",
                  }))
                }
              />
              <p className="text-[0.7rem] text-[var(--ink-muted)]">
                Ops P&amp;L buckets by this month (e.g. Airbnb paid June 1 for May stays).
              </p>
            </div>
          ) : null}

          <div className="field">
            <label>Category</label>
            <select
              value={form.category_id}
              onChange={(e) => {
                const cat = filteredCats.find((c) => c.id === e.target.value);
                setForm((f) => ({
                  ...f,
                  category_id: e.target.value,
                  cadence: cat?.cadence ?? f.cadence,
                }));
              }}
            >
              {filteredCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="field">
              <label>Unit</label>
              <select
                value={form.unit_id}
                onChange={(e) => setForm((f) => ({ ...f, unit_id: e.target.value }))}
              >
                <option value="">Building / shared</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Account</label>
              <select
                value={form.payment_account}
                onChange={(e) => setForm((f) => ({ ...f, payment_account: e.target.value }))}
              >
                <option value="">Select</option>
                {PAYMENT_ACCOUNTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Vendor</label>
            <input
              value={form.vendor}
              onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
              placeholder="Optional"
            />
          </div>

          <div className="field">
            <label>Notes</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Source, invoice #, etc."
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button type="submit" className="btn btn-primary flex-1">
            Save
          </button>
          {initial && onDelete ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => {
                try {
                  await onDelete(initial.id);
                  onClose();
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Failed to delete transaction");
                }
              }}
            >
              Delete
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
