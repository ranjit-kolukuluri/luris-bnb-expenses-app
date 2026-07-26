"""Classify Chase/Prime/BoA purchases into reno expense types."""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

out = Path(r"C:\Users\ranji\projects\luris-bnb-expense-management-app\tmp-statement-parse")
data = json.loads((out / "parse-results.json").read_text(encoding="utf-8"))

CONSTRUCTION = [
    r"HOME DEPOT",
    r"CITY ELECTRIC",
    r"TSIGONIA",
    r"DUNCAN HARDWARE",
    r"MARBCON",
    r"KEARNY KITCHEN",
    r"PAINT AND HARDWA",
    r"LOWES",
    r"LOWE'S",
]
FURNITURE = [
    r"WAYFAIR",
    r"HOMEGOODS",
    r"HOME GOODS",
    r"AT HOME STORE",
    r"MARSHALLS",
    r"IKEA",
    r"ASHLEY",
    r"WAYFAIR",
    r"TEMPUR",
    r"ROVE CONCEPTS",
]
APPLIANCES = [
    r"PC\.RICHARD",
    r"BEST BUY",
    r"BESTBUY",
]
ONLINE_MIXED = [
    r"AMAZON",
    r"AMZN",
    r"TEMU",
    r"SHEIN",
    r"WALMART",
    r"TARGET",
    r"MICHAELS",
]
EXCLUDE = [
    r"MINI OF RAMSEY",
    r"GOOGLE",
    r"GODADDY",
    r"LINGOACE",
    r"ALLBIRDS",
    r"SHOPRITE",
    r"INDIA BAZAAR",
    r"FRESH GROCER",
    r"BAO DUMPLING",
    r"CVS/",
    r"PSE&G",
    r"bizee\.com",
    r"NJ ANNUAL REPORT",
    r"CORP CHARITY",
    r"ZEFFY",
    r"FOREIGN TRANSACTION",
    r"AMK NYL",
    r"TRNA TERMINAL",
    r"RUMBO",
    r"MXM JACO",
    r"PUNTARENAS",
    r"ALAJUELA",
]


def classify(desc: str) -> str:
    d = desc.upper()
    for pat in EXCLUDE:
        if re.search(pat, d, re.I):
            return "excluded"
    for pat in CONSTRUCTION:
        if re.search(pat, d, re.I):
            return "construction"
    for pat in APPLIANCES:
        if re.search(pat, d, re.I):
            return "appliances"
    for pat in FURNITURE:
        if re.search(pat, d, re.I):
            return "furniture"
    for pat in ONLINE_MIXED:
        if re.search(pat, d, re.I):
            return "online_marketplace"
    return "other_reno"


totals: dict[str, float] = defaultdict(float)
lines: dict[str, list] = defaultdict(list)

for e in data["chase"]:
    for p in e.get("purchases", []):
        amt = float(p["amount"])
        cat = classify(p["description"])
        totals[cat] += amt
        lines[cat].append((e["file"], p["date"], amt, p["description"]))

# Prime: treat statement purchases (net of credits already in statement total) as online marketplace
# Prefer unique periods from text files
prime_total = 0.0
seen = set()
for p in sorted(out.glob("*Prime*.txt")):
    text = p.read_text(encoding="utf-8", errors="replace")
    m = re.search(r"Purchases \+\$([\d,]+\.\d{2})", text)
    period = re.search(
        r"Opening/Closing Date (\d{2}/\d{2}/\d{2}) - (\d{2}/\d{2}/\d{2})", text
    )
    if not m or not period:
        continue
    per = f"{period.group(1)}-{period.group(2)}"
    if per in seen:
        continue
    seen.add(per)
    amt = float(m.group(1).replace(",", ""))
    prime_total += amt

totals["online_marketplace"] += prime_total
lines["online_marketplace"].append(("Prime(all)", "period", prime_total, "Amazon Prime Visa purchases (unique periods)"))

# Best Buy from BoA
bestbuy = []
for p in sorted(set(list(out.glob("*Boa*.txt")) + list(out.glob("*BoA*.txt")))):
    text = p.read_text(encoding="utf-8", errors="replace")
    norm = re.sub(r"(?=\d{2}/\d{2}/\d{2})", "\n", text)
    for ln in norm.splitlines():
        if re.search(r"BEST BUY", ln, re.I):
            am = re.search(r"WEB(-[\d,]+\.\d{2})", ln) or re.search(
                r"(-[\d,]+\.\d{2})", ln
            )
            if am:
                amt = abs(float(am.group(1).replace(",", "")))
                date = ln[:8]
                bestbuy.append((p.name, date, amt, ln[:120]))
                totals["appliances"] += amt
                lines["appliances"].append((p.name, date, amt, "BEST BUY auto pay"))

print("=== TOTALS BY CLASS ===")
for k in sorted(totals, key=lambda x: -abs(totals[x])):
    print(f"{k:20s} {totals[k]:12.2f}")

print("\nBestBuy:", bestbuy, "sum", sum(b[2] for b in bestbuy))
print("Prime added:", prime_total)

reno_materials = (
    totals["construction"]
    + totals["furniture"]
    + totals["online_marketplace"]
    + totals["appliances"]
    + totals["other_reno"]
)
print("\nReno materials+appliances (excl contractor):", round(reno_materials, 2))
print("Excluded from reno:", round(totals["excluded"], 2))

# dump detail for construction/furniture
for cat in ["construction", "furniture", "appliances", "other_reno", "excluded"]:
    print(f"\n--- {cat} ---")
    for row in lines[cat][:30]:
        print(f"  {row[2]:10.2f}  {row[3][:65]}")
    if len(lines[cat]) > 30:
        print(f"  ... +{len(lines[cat])-30}")

result = {
    "totals": {k: round(v, 2) for k, v in totals.items()},
    "prime_total": round(prime_total, 2),
    "bestbuy": [{"file": a, "date": b, "amount": c} for a, b, c, _ in bestbuy],
    "reno_goods_total": round(reno_materials, 2),
}
(out / "reno-classification.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print("\nWrote reno-classification.json")
