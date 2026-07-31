/**
 * Migration script to set expense_group on existing transactions
 * Run with: npx tsx scripts/fix-expense-groups.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixExpenseGroups() {
  console.log("🔍 Finding transactions that need expense_group...\n");

  // Get all transactions without expense_group
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("type", "expense")
    .is("deleted_at", null);

  if (error) {
    console.error("Error fetching transactions:", error);
    return;
  }

  console.log(`Found ${transactions.length} expense transactions\n`);

  const updates: Array<{ id: string; title: string; expense_group: string; expense_subgroup?: string }> = [];

  for (const tx of transactions) {
    if (tx.expense_group) continue; // Already has group

    const title = tx.title?.toLowerCase() || "";
    const vendor = tx.vendor?.toLowerCase() || "";
    const description = tx.description?.toLowerCase() || "";
    const text = `${title} ${vendor} ${description}`;

    // Pattern matching to auto-classify
    if (
      /contractor|artway|james|electrical|plumbing|labor|renovation|reno/.test(text) ||
      /israel.*reno|israel.*1r|israel.*contractor/.test(text)
    ) {
      updates.push({
        id: tx.id,
        title: tx.title,
        expense_group: "contractor_fees",
        expense_subgroup: "labor",
      });
    } else if (
      /material|home depot|lowes|supplies|appliance|furniture|wayfair/.test(text)
    ) {
      updates.push({
        id: tx.id,
        title: tx.title,
        expense_group: "materials",
      });
    } else if (/interior|design|lulu|decor/.test(text)) {
      updates.push({
        id: tx.id,
        title: tx.title,
        expense_group: "interior_design",
      });
    } else if (
      /property management|hosting fee|management fee/.test(text) &&
      !/weed|snow|cleanup/.test(text)
    ) {
      updates.push({
        id: tx.id,
        title: tx.title,
        expense_group: "property_management",
      });
    }
  }

  console.log(`\n📝 Will update ${updates.length} transactions:\n`);
  
  updates.forEach((u) => {
    console.log(`  - ${u.title}`);
    console.log(`    → ${u.expense_group}${u.expense_subgroup ? ` / ${u.expense_subgroup}` : ""}\n`);
  });

  if (updates.length === 0) {
    console.log("✅ No transactions need updating!");
    return;
  }

  console.log("\n🚀 Applying updates...");

  for (const update of updates) {
    const { error } = await supabase
      .from("transactions")
      .update({
        expense_group: update.expense_group,
        expense_subgroup: update.expense_subgroup || null,
      })
      .eq("id", update.id);

    if (error) {
      console.error(`❌ Failed to update ${update.id}:`, error);
    } else {
      console.log(`✅ Updated: ${update.title}`);
    }
  }

  console.log("\n✨ Migration complete!");
  console.log("\nNext steps:");
  console.log("1. Refresh your app (hard reload)");
  console.log("2. Check July 2026 ops costs - contractor fees should be gone");
  console.log("3. Verify monthly net is positive");
}

fixExpenseGroups()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
