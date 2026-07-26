"""Parse Luris BnB bank statements for reno materials and income/expense keywords."""
from __future__ import annotations

from pathlib import Path
from pypdf import PdfReader
import re
import json
from collections import defaultdict

BASE = Path(r"C:\Users\ranji\luris-bnb-app\Bank-Statements")
OUT = Path(r"C:\Users\ranji\projects\luris-bnb-expense-management-app\tmp-statement-parse")
OUT.mkdir(exist_ok=True)

MONEY = re.compile(r"-?\$?\d{1,3}(?:,\d{3})*\.\d{2}")


def full_text(path: Path) -> str:
    r = PdfReader(str(path))
    return "\n".join((p.extract_text() or "") for p in r.pages)


def parse_money(s: str) -> float | None:
    m = MONEY.search(s.replace(" ", ""))
    if not m:
        # try last money-like token on line
        ms = MONEY.findall(s)
        if not ms:
            return None
        raw = ms[-1]
    else:
        raw = m.group(0)
    raw = raw.replace("$", "").replace(",", "")
    try:
        return float(raw)
    except ValueError:
        return None


def chase_purchases(text: str) -> list[dict]:
    """Extract purchase lines from Chase statements."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    purchases = []
    in_purchases = False
    for i, ln in enumerate(lines):
        if ln.upper() == "PURCHASE" or ln.upper().startswith("PURCHASES"):
            in_purchases = True
            continue
        if in_purchases and (
            ln.startswith("Total fees")
            or ln.startswith("INTEREST CHARGED")
            or ln.startswith("Year-to-date")
            or "Interest Charged" in ln
            or ln.startswith("PAYMENTS AND OTHER CREDITS")
        ):
            # don't exit too early on PURCHASES header section
            if "PURCHASE" in ln.upper() and "Transaction" in ln:
                continue
            if ln.startswith("PAYMENTS AND OTHER CREDITS") or ln.startswith("INTEREST CHARGED"):
                in_purchases = False
            continue

        # Typical: MM/DD  DESCRIPTION  amount
        # or date on one line, desc+amount nearby
        m = re.match(
            r"^(\d{2}/\d{2})\s+(.+?)\s+(-?\d{1,3}(?:,\d{3})*\.\d{2})$",
            ln,
        )
        if m:
            date, desc, amt = m.groups()
            amount = float(amt.replace(",", ""))
            # skip payments / credits that are negative large autopay
            if "AUTOMATIC PAYMENT" in desc.upper() or "PAYMENT THANK YOU" in desc.upper():
                continue
            if "ANNUAL MEMBERSHIP" in desc.upper():
                continue
            purchases.append({"date": date, "description": desc.strip(), "amount": amount})
            continue

        # Alternate layout: date then description, amount alone
        m2 = re.match(r"^(\d{2}/\d{2})\s+(.+)$", ln)
        if m2 and i + 1 < len(lines):
            nxt = lines[i + 1]
            mamt = re.match(r"^(-?\d{1,3}(?:,\d{3})*\.\d{2})$", nxt.replace("$", "").strip())
            if mamt:
                amount = float(mamt.group(1).replace(",", ""))
                desc = m2.group(2)
                if "AUTOMATIC PAYMENT" in desc.upper():
                    continue
                purchases.append(
                    {"date": m2.group(1), "description": desc.strip(), "amount": amount}
                )

    return purchases


def chase_summary(text: str) -> dict:
    out = {}
    m = re.search(r"Purchases\s+\+?\$?([\d,]+\.\d{2})", text)
    if m:
        out["purchases_total"] = float(m.group(1).replace(",", ""))
    m = re.search(r"New Balance:\s*\$?([\d,]+\.\d{2})", text)
    if m:
        out["new_balance"] = float(m.group(1).replace(",", ""))
    m = re.search(r"Opening/Closing Date\s+(\d{2}/\d{2}/\d{2})\s*-\s*(\d{2}/\d{2}/\d{2})", text)
    if m:
        out["period"] = f"{m.group(1)}-{m.group(2)}"
    return out


def prime_transactions(text: str) -> list[dict]:
    """Prime statements — look for purchase-like debit lines."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    txs = []
    for ln in lines:
        # common patterns with date and amount at end
        m = re.match(
            r"^(\d{1,2}/\d{1,2}(?:/\d{2,4})?)\s+(.+?)\s+(-?\$?\d{1,3}(?:,\d{3})*\.\d{2})\s*$",
            ln,
        )
        if m:
            date, desc, amt = m.groups()
            amount = float(amt.replace("$", "").replace(",", ""))
            txs.append({"date": date, "description": desc.strip(), "amount": amount, "raw": ln})
    return txs


def keyword_hits(text: str, keywords: list[str]) -> list[dict]:
    hits = []
    for ln in text.splitlines():
        low = ln.lower()
        if any(k.lower() in low for k in keywords):
            amt = parse_money(ln)
            hits.append({"line": ln.strip(), "amount": amt})
    return hits


results = {
    "chase": [],
    "prime": [],
    "boa_keywords": [],
    "bluvine_keywords": [],
}

# --- Chase ---
chase_all_purchases = []
for f in sorted(BASE.glob("*Chase*.pdf")):
    text = full_text(f)
    (OUT / f"{f.stem}.txt").write_text(text, encoding="utf-8", errors="replace")
    purchases = chase_purchases(text)
    summary = chase_summary(text)
    total_from_lines = round(sum(p["amount"] for p in purchases if p["amount"] > 0), 2)
    entry = {
        "file": f.name,
        "summary": summary,
        "parsed_purchase_count": len(purchases),
        "parsed_purchase_sum": total_from_lines,
        "purchases": purchases,
    }
    results["chase"].append(entry)
    chase_all_purchases.extend(purchases)
    print(f"CHASE {f.name}: summary={summary} parsed={len(purchases)} sum={total_from_lines}")

# --- Prime ---
prime_all = []
for f in sorted(BASE.glob("*Prime*.pdf")):
    text = full_text(f)
    (OUT / f"{f.stem}.txt").write_text(text, encoding="utf-8", errors="replace")
    txs = prime_transactions(text)
    # Also dump money-bearing lines for manual review
    money_lines = [ln.strip() for ln in text.splitlines() if MONEY.search(ln)]
    entry = {
        "file": f.name,
        "tx_count": len(txs),
        "transactions": txs,
        "money_line_count": len(money_lines),
        "money_lines_sample": money_lines[:100],
    }
    results["prime"].append(entry)
    prime_all.extend(txs)
    print(f"PRIME {f.name}: txs={len(txs)} money_lines={len(money_lines)}")

# --- BoA keywords ---
boa_kw = [
    "zelle",
    "arial",
    "ariel",
    "reno",
    "isreal",
    "israel",
    "adeyanju",
    "adjenyu",
    "james",
    "water",
    "viola",
    "veolia",
    "pse&g",
    "pseg",
    "utility",
]
for f in sorted(BASE.glob("*Boa*.pdf")) + sorted(BASE.glob("*BoA*.pdf")):
    # avoid dupes
    pass

seen = set()
for f in sorted(BASE.glob("*.pdf")):
    name = f.name.lower()
    if "boa" not in name:
        continue
    if f.name in seen:
        continue
    seen.add(f.name)
    text = full_text(f)
    (OUT / f"{f.stem}.txt").write_text(text, encoding="utf-8", errors="replace")
    hits = keyword_hits(text, boa_kw)
    results["boa_keywords"].append({"file": f.name, "hits": hits})
    print(f"BOA {f.name}: keyword hits={len(hits)}")
    for h in hits:
        print(f"  {h['amount']}\t{h['line'][:140]}")

# --- BlueVine ---
bv_kw = [
    "airbnb",
    "apartments.com",
    "apartment",
    "zelle",
    "deposit",
    "ach",
    "rent",
    "payout",
]
for f in sorted(BASE.glob("*Blu*.pdf")) + sorted(BASE.glob("*Blue*.pdf")):
    text = full_text(f)
    (OUT / f"{f.stem}.txt").write_text(text, encoding="utf-8", errors="replace")
    hits = keyword_hits(text, bv_kw)
    results["bluvine_keywords"].append({"file": f.name, "hits": hits})
    print(f"BLUVINE {f.name}: keyword hits={len(hits)}")
    for h in hits:
        print(f"  {h['amount']}\t{h['line'][:140]}")

# Save JSON
(OUT / "parse-results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")

chase_total = round(
    sum(
        e["summary"].get("purchases_total")
        or e["parsed_purchase_sum"]
        for e in results["chase"]
    ),
    2,
)
print("\n=== CHASE PURCHASES TOTAL (prefer statement summary) ===")
for e in results["chase"]:
    print(e["file"], e["summary"], "parsed_sum", e["parsed_purchase_sum"])
print("SUM summaries:", round(sum(e["summary"].get("purchases_total", 0) or 0 for e in results["chase"]), 2))
print("SUM parsed:", round(sum(e["parsed_purchase_sum"] for e in results["chase"]), 2))
