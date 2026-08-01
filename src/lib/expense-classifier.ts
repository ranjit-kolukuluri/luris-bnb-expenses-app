/**
 * Smart expense classifier
 * Auto-suggests expense_group and expense_subgroup based on transaction details
 */

import type { ExpenseGroup, ExpenseSubgroup } from "./types";

export interface ClassificationSuggestion {
  expenseGroup: ExpenseGroup | null;
  expenseSubgroup: ExpenseSubgroup | null;
  confidence: "high" | "medium" | "low";
  reason: string;
}

/**
 * Classify an expense based on title, vendor, amount, and description
 */
export function classifyExpense(data: {
  title: string;
  vendor?: string;
  amount?: number;
  description?: string;
}): ClassificationSuggestion {
  const text = `${data.title} ${data.vendor || ""} ${data.description || ""}`.toLowerCase();
  const amount = data.amount || 0;

  // Contractor fees patterns
  if (
    /contractor|artway|james|electrical|plumbing|labor|renovation|reno/i.test(text) ||
    (/israel|is a realtor/i.test(text) && (amount > 1000 || /reno|1r|1l|2r|contractor/i.test(text)))
  ) {
    return {
      expenseGroup: "contractor_fees",
      expenseSubgroup: "labor",
      confidence: "high",
      reason: "Contains contractor/renovation keywords or high-value payment to contractor",
    };
  }

  // Materials patterns
  if (
    /material|home depot|lowes|supplies|appliance|furniture|wayfair|best buy|pc richard/i.test(text) ||
    /home improvement|hardware|lumber|paint|flooring/i.test(text)
  ) {
    return {
      expenseGroup: "materials",
      expenseSubgroup: /furniture|wayfair/i.test(text) 
        ? "furniture" 
        : /appliance|best buy|pc richard/i.test(text)
        ? "appliances"
        : "construction",
      confidence: "high",
      reason: "Contains materials/supplies keywords or known retailer",
    };
  }

  // Interior design patterns
  if (/interior|design|lulu|decor|staging/i.test(text)) {
    return {
      expenseGroup: "interior_design",
      expenseSubgroup: "lulu",
      confidence: "high",
      reason: "Contains interior design keywords",
    };
  }

  // Property management patterns (excluding ops tasks)
  if (
    (/property management|hosting fee|management fee|monthly management/i.test(text) &&
      !/weed|snow|cleanup|repair|maintenance/i.test(text)) ||
    (/israel|is a realtor/i.test(text) && amount > 0 && amount < 1000 && /management|fee|monthly/i.test(text))
  ) {
    return {
      expenseGroup: "property_management",
      expenseSubgroup: amount < 500 || /hosting/i.test(text) 
        ? "hosting_fees" 
        : "monthly_mgmt",
      confidence: "medium",
      reason: "Contains management keywords or typical management payment amount",
    };
  }

  // No clear classification
  return {
    expenseGroup: null,
    expenseSubgroup: null,
    confidence: "low",
    reason: "No clear pattern match - manual classification recommended",
  };
}

/**
 * Get a human-readable suggestion message
 */
export function getSuggestionMessage(suggestion: ClassificationSuggestion): string {
  if (!suggestion.expenseGroup) return "";
  
  const labels: Record<ExpenseGroup, string> = {
    contractor_fees: "Contractor fees",
    materials: "Materials",
    interior_design: "Interior design",
    property_management: "Property management",
  };

  const confidence = {
    high: "✓",
    medium: "~",
    low: "?",
  }[suggestion.confidence];

  return `${confidence} Suggested: ${labels[suggestion.expenseGroup]}`;
}
