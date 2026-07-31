"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  SEED_CATEGORIES,
  SEED_PROPERTY,
  SEED_TRANSACTIONS,
  SEED_UNITS,
} from "./seed";
import type { Category, Property, Transaction, Unit } from "./types";
import { computeMetrics } from "./calculations";
import { createClient, isSupabaseConfigured } from "./supabase/client";
import {
  claimDefaultProperty,
  fetchPropertyBundle,
  invitePropertyMember,
} from "./supabase/data";

const STORAGE_KEY = "luris-bnb-local-v2";
const SEED_VERSION = 11;

interface LocalState {
  seedVersion: number;
  property: Property;
  units: Unit[];
  categories: Category[];
  transactions: Transaction[];
  partnerName: string;
}

interface DataContextValue {
  ready: boolean;
  mode: "local" | "cloud";
  user: User | null;
  property: Property;
  units: Unit[];
  categories: Category[];
  transactions: Transaction[];
  partnerName: string;
  setPartnerName: (name: string) => void;
  addTransaction: (tx: Omit<Transaction, "id" | "property_id" | "is_seeded">) => Promise<void>;
  updateTransaction: (id: string, patch: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  updateUnit: (id: string, patch: Partial<Unit>) => void;
  metrics: ReturnType<typeof computeMetrics>;
  selectedMonth: { year: number; month: number };
  setSelectedMonth: (v: { year: number; month: number }) => void;
  signInWithEmail: (email: string) => Promise<string>;
  signOut: () => Promise<void>;
  claimCloudProperty: () => Promise<void>;
  invitePartner: (email: string) => Promise<void>;
  refreshCloud: () => Promise<void>;
  cloudMessage: string | null;
}

const DataContext = createContext<DataContextValue | null>(null);

function defaultState(): LocalState {
  return {
    seedVersion: SEED_VERSION,
    property: SEED_PROPERTY,
    units: SEED_UNITS,
    categories: SEED_CATEGORIES,
    transactions: SEED_TRANSACTIONS,
    partnerName: "Shruthi Dantuluri",
  };
}

function loadState(): LocalState {
  if (typeof window === "undefined") return defaultState();
  try {
    localStorage.removeItem("luris-bnb-local-v1");
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as LocalState;
    if (parsed.seedVersion !== SEED_VERSION) {
      return {
        ...defaultState(),
        partnerName: parsed.partnerName || "Shruthi Dantuluri",
      };
    }
    const userTx = (parsed.transactions || []).filter((t) => !t.is_seeded);
    return {
      ...defaultState(),
      partnerName: parsed.partnerName || "Shruthi Dantuluri",
      units: mergeUnitEdits(SEED_UNITS, parsed.units),
      transactions: [...SEED_TRANSACTIONS, ...userTx],
    };
  } catch {
    return defaultState();
  }
}

function mergeUnitEdits(seed: Unit[], saved?: Unit[]) {
  if (!saved?.length) return seed;
  return seed.map((u) => {
    const prev = saved.find((s) => s.id === u.id || s.code === u.code);
    if (!prev) return u;
    return {
      ...u,
      expected_monthly_rent:
        prev.expected_monthly_rent ?? u.expected_monthly_rent,
      status: prev.status ?? u.status,
    };
  });
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LocalState>(defaultState);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"local" | "cloud">("local");
  const [user, setUser] = useState<User | null>(null);
  const [cloudMessage, setCloudMessage] = useState<string | null>(null);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });

  const applyCloudBundle = useCallback(
    async (session: Session | null) => {
      const sb = createClient();
      if (!sb || !session) {
        setMode("local");
        setUser(null);
        return;
      }
      setUser(session.user);
      try {
        const bundle = await fetchPropertyBundle(sb);
        if (!bundle.property) {
          setMode("local");
          setCloudMessage(
            "Signed in. Claim the cloud property in Settings to load shared data."
          );
          return;
        }
        setState((s) => ({
          ...s,
          property: bundle.property!,
          units: bundle.units,
          categories: bundle.categories,
          transactions: bundle.transactions,
        }));
        setMode("cloud");
        setCloudMessage(null);
      } catch (err) {
        setMode("local");
        setCloudMessage(
          err instanceof Error
            ? err.message
            : "Could not load cloud data — using local copy."
        );
      }
    },
    []
  );

  useEffect(() => {
    setState(loadState());
    setReady(true);

    if (!isSupabaseConfigured()) return;
    const sb = createClient();
    if (!sb) return;

    sb.auth.getSession().then(({ data }) => {
      void applyCloudBundle(data.session);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      void applyCloudBundle(session);
    });
    return () => sub.subscription.unsubscribe();
  }, [applyCloudBundle]);

  // Real-time subscription for transactions when in cloud mode
  useEffect(() => {
    if (!ready || mode !== "cloud" || !user) return;

    const sb = createClient();
    if (!sb) return;

    const channel = sb
      .channel("transactions-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `property_id=eq.${state.property.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newTx = {
              ...payload.new,
              is_seeded: Boolean(payload.new.is_seeded),
            } as Transaction;
            
            // Only add if not already in state (avoid duplicates from optimistic updates)
            setState((s) => {
              const exists = s.transactions.some((t) => t.id === newTx.id);
              if (exists) return s;
              return { ...s, transactions: [newTx, ...s.transactions] };
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedTx = {
              ...payload.new,
              is_seeded: Boolean(payload.new.is_seeded),
            } as Transaction;
            
            // Check if transaction was soft-deleted
            const wasDeleted = Boolean((payload.new as any).deleted_at);
            
            setState((s) => ({
              ...s,
              transactions: wasDeleted
                ? s.transactions.filter((t) => t.id !== updatedTx.id)
                : s.transactions.map((t) =>
                    t.id === updatedTx.id ? updatedTx : t
                  ),
            }));
          } else if (payload.eventType === "DELETE") {
            setState((s) => ({
              ...s,
              transactions: s.transactions.filter((t) => t.id !== payload.old.id),
            }));
          }
        }
      )
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [ready, mode, user, state.property.id]);

  useEffect(() => {
    if (!ready || mode === "cloud") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, ready, mode]);

  const refreshCloud = useCallback(async () => {
    const sb = createClient();
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    await applyCloudBundle(data.session);
  }, [applyCloudBundle]);

  const signInWithEmail = useCallback(async (email: string) => {
    const sb = createClient();
    if (!sb) throw new Error("Supabase is not configured");
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback`
        : undefined;
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
    return "Check your email for the magic link.";
  }, []);

  const signOut = useCallback(async () => {
    const sb = createClient();
    if (sb) await sb.auth.signOut();
    setUser(null);
    setMode("local");
    setState(loadState());
    setCloudMessage(null);
  }, []);

  const claimCloudProperty = useCallback(async () => {
    const sb = createClient();
    if (!sb) throw new Error("Supabase is not configured");
    await claimDefaultProperty(sb);
    setCloudMessage("Property claimed. Loading shared ledger…");
    await refreshCloud();
  }, [refreshCloud]);

  const invitePartner = useCallback(async (email: string) => {
    const sb = createClient();
    if (!sb) throw new Error("Supabase is not configured");
    await invitePropertyMember(sb, email.trim(), "partner");
    setCloudMessage(`Invited ${email.trim()} as partner.`);
  }, []);

  const addTransaction = useCallback(
    async (tx: Omit<Transaction, "id" | "property_id" | "is_seeded">) => {
      const id =
        mode === "cloud" ? crypto.randomUUID() : `tx-${crypto.randomUUID()}`;
      const row: Transaction = {
        ...tx,
        id,
        property_id: state.property.id,
        is_seeded: false,
      };
      
      // Optimistic update - add to local state immediately
      setState((s) => ({ ...s, transactions: [row, ...s.transactions] }));

      if (mode === "cloud") {
        const sb = createClient();
        if (!sb) {
          throw new Error("Supabase client not available");
        }
        
        const { error } = await sb.from("transactions").insert({
          id: row.id,
          property_id: row.property_id,
          unit_id: row.unit_id,
          category_id: row.category_id,
          type: row.type,
          cadence: row.cadence,
          title: row.title,
          description: row.description,
          amount: row.amount,
          occurred_on: row.occurred_on,
          applies_on: row.applies_on ?? null,
          payment_account: row.payment_account,
          vendor: row.vendor,
          expense_group: row.expense_group ?? null,
          expense_subgroup: row.expense_subgroup ?? null,
          is_seeded: false,
          created_by: user?.id ?? null,
        });
        
        if (error) {
          // Rollback on error
          setState((s) => ({
            ...s,
            transactions: s.transactions.filter((t) => t.id !== row.id),
          }));
          throw new Error(`Failed to save: ${error.message}`);
        }
      }
    },
    [mode, state.property.id, user?.id]
  );

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<Transaction>) => {
      const oldState = state.transactions.find((t) => t.id === id);
      
      // Optimistic update
      setState((s) => ({
        ...s,
        transactions: s.transactions.map((t) =>
          t.id === id ? { ...t, ...patch } : t
        ),
      }));
      
      if (mode === "cloud") {
        const sb = createClient();
        if (!sb) {
          throw new Error("Supabase client not available");
        }
        
        const { error } = await sb.from("transactions").update({
          ...patch,
          updated_by: user?.id ?? null,
        }).eq("id", id);
        
        if (error) {
          // Rollback on error
          if (oldState) {
            setState((s) => ({
              ...s,
              transactions: s.transactions.map((t) =>
                t.id === id ? oldState : t
              ),
            }));
          }
          throw new Error(`Failed to update: ${error.message}`);
        }
      }
    },
    [mode, user?.id, state.transactions]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      const oldTx = state.transactions.find((t) => t.id === id);
      
      // Optimistic update
      setState((s) => ({
        ...s,
        transactions: s.transactions.filter((t) => t.id !== id),
      }));
      
      if (mode === "cloud") {
        const sb = createClient();
        if (!sb) {
          throw new Error("Supabase client not available");
        }
        
        const { error } = await sb
          .from("transactions")
          .update({ deleted_at: new Date().toISOString(), updated_by: user?.id ?? null })
          .eq("id", id);
        
        if (error) {
          // Rollback on error
          if (oldTx) {
            setState((s) => ({
              ...s,
              transactions: [oldTx, ...s.transactions],
            }));
          }
          throw new Error(`Failed to delete: ${error.message}`);
        }
      }
    },
    [mode, user?.id, state.transactions]
  );

  const setPartnerName = useCallback((name: string) => {
    setState((s) => ({ ...s, partnerName: name }));
  }, []);

  const updateUnit = useCallback(
    (id: string, patch: Partial<Unit>) => {
      setState((s) => ({
        ...s,
        units: s.units.map((u) => (u.id === id ? { ...u, ...patch } : u)),
      }));
      if (mode === "cloud") {
        const sb = createClient();
        void sb?.from("units").update(patch).eq("id", id);
      }
    },
    [mode]
  );

  const metrics = useMemo(
    () =>
      computeMetrics(state.transactions, {
        year: selectedMonth.year,
        month: selectedMonth.month,
        mortgageFallback: state.property.monthly_mortgage_total,
      }),
    [state.transactions, state.property.monthly_mortgage_total, selectedMonth]
  );

  const value: DataContextValue = {
    ready,
    mode,
    user,
    property: state.property,
    units: state.units,
    categories: state.categories,
    transactions: state.transactions,
    partnerName: state.partnerName,
    setPartnerName,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    updateUnit,
    metrics,
    selectedMonth,
    setSelectedMonth,
    signInWithEmail,
    signOut,
    claimCloudProperty,
    invitePartner,
    refreshCloud,
    cloudMessage,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
