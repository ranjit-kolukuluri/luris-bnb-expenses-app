import type { Category, Property, Transaction, Unit } from "../types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchPropertyBundle(sb: SupabaseClient) {
  const { data: properties, error: pErr } = await sb
    .from("properties")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1);
  if (pErr) throw pErr;
  const property = (properties?.[0] ?? null) as Property | null;
  if (!property) {
    return { property: null, units: [] as Unit[], categories: [] as Category[], transactions: [] as Transaction[] };
  }

  const [{ data: units, error: uErr }, { data: categories, error: cErr }, { data: transactions, error: tErr }] =
    await Promise.all([
      sb.from("units").select("*").eq("property_id", property.id).order("sort_order"),
      sb.from("categories").select("*").eq("property_id", property.id).order("sort_order"),
      sb
        .from("transactions")
        .select("*")
        .eq("property_id", property.id)
        .is("deleted_at", null)
        .order("occurred_on", { ascending: false }),
    ]);

  if (uErr) throw uErr;
  if (cErr) throw cErr;
  if (tErr) throw tErr;

  return {
    property,
    units: (units ?? []) as Unit[],
    categories: (categories ?? []) as Category[],
    transactions: (transactions ?? []).map((t) => ({
      ...t,
      is_seeded: Boolean(t.is_seeded),
    })) as Transaction[],
  };
}

export async function claimDefaultProperty(sb: SupabaseClient) {
  const { data, error } = await sb.rpc("claim_default_property");
  if (error) throw error;
  return data as string;
}

export async function invitePropertyMember(
  sb: SupabaseClient,
  email: string,
  role: "owner" | "partner" = "partner"
) {
  const { data, error } = await sb.rpc("invite_property_member", {
    member_email: email,
    member_role: role,
  });
  if (error) throw error;
  return data as string;
}
