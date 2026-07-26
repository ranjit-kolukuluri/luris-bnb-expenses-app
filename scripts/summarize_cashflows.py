from pathlib import Path
import re

out = Path(r"C:\Users\ranji\projects\luris-bnb-expense-management-app\tmp-statement-parse")

print("=== PRIME PURCHASE TOTALS ===")
prime_total = 0.0
seen_periods: dict[str, float] = {}
for p in sorted(out.glob("*Prime*.txt")):
    text = p.read_text(encoding="utf-8", errors="replace")
    m = re.search(r"Purchases \+\$([\d,]+\.\d{2})", text)
    period = re.search(
        r"Opening/Closing Date (\d{2}/\d{2}/\d{2}) - (\d{2}/\d{2}/\d{2})", text
    )
    purchases = float(m.group(1).replace(",", "")) if m else None
    per = f"{period.group(1)}-{period.group(2)}" if period else "?"
    print(p.name, "period", per, "purchases", purchases)
    if purchases is None:
        continue
    if per not in seen_periods:
        seen_periods[per] = purchases
        prime_total += purchases
    else:
        print("  DUPLICATE PERIOD - skip")

print("Prime unique total:", round(prime_total, 2))

print("\n=== CHASE ===")
chase_total = 0.0
for p in sorted(out.glob("*Chase*.txt")):
    text = p.read_text(encoding="utf-8", errors="replace")
    m = re.search(r"Purchases \+\$([\d,]+\.\d{2})", text)
    period = re.search(
        r"Opening/Closing Date (\d{2}/\d{2}/\d{2}) - (\d{2}/\d{2}/\d{2})", text
    )
    purchases = float(m.group(1).replace(",", "")) if m else 0.0
    per = f"{period.group(1)}-{period.group(2)}" if period else "?"
    print(p.name, per, purchases)
    chase_total += purchases
print("Chase total:", round(chase_total, 2))
materials = round(chase_total + prime_total, 2)
print("Materials combined:", materials)
print(
    "Split 60/20/20 1R/1L/2R:",
    round(materials * 0.6, 2),
    round(materials * 0.2, 2),
    round(materials * 0.2, 2),
)

# Contractor payments attributed by memo
artway = []
israel = []
ariel_income = []
pseg = []
other_prop = []

pat_out = re.compile(
    r"(\d{2}/\d{2}/\d{2})Zelle payment to\s+(.+?)\s+for\s+\"([^\"]*)\".*?(-[\d,]+\.\d{2})",
    re.I,
)
pat_out2 = re.compile(
    r"(\d{2}/\d{2}/\d{2})Zelle payment to\s+(.+?)Conf#\s*\S+\s*(-[\d,]+\.\d{2})",
    re.I,
)
pat_from = re.compile(
    r"(\d{2}/\d{2}/\d{2})Zelle payment from\s+(ARIEL Y BLANCA|ARIAL[^\d]*)\s+Conf#\s*\S+([\d,]+\.\d{2})",
    re.I,
)
pat_pseg = re.compile(
    r"(\d{2}/\d{2}/\d{2})PUBLIC SERVICE\s+DES:PSEG.*?PPD(-[\d,]+\.\d{2})",
    re.I,
)

print("\n=== STRUCTURED BOA ===")
for p in sorted(set(list(out.glob("*Boa*.txt")) + list(out.glob("*BoA*.txt")))):
    text = p.read_text(encoding="utf-8", errors="replace")
    norm = re.sub(r"(?=\d{2}/\d{2}/\d{2})", "\n", text)
    for ln in norm.splitlines():
        ln = ln.strip()
        m = pat_from.search(ln.replace(" ", " "))
        # Ariel income
        if re.search(r"Zelle payment from\s+ARIEL", ln, re.I):
            am = re.search(r"([\d,]+\.\d{2})\s*$", ln) or re.search(
                r"Conf#\s*\S+([\d,]+\.\d{2})", ln
            )
            # amounts glued: Conf# AA0aCA89K700.00
            am = re.search(r"Conf#\s*\S+?([\d,]+\.\d{2})", ln)
            if am:
                ariel_income.append(
                    {
                        "date": ln[:8],
                        "amount": float(am.group(1).replace(",", "")),
                        "line": ln[:180],
                        "file": p.name,
                    }
                )
            continue

        if "Zelle payment to" in ln:
            am = re.search(r"(-\d{1,3}(?:,\d{3})*\.\d{2})", ln)
            if not am:
                continue
            amount = abs(float(am.group(1).replace(",", "")))
            date = ln[:8]
            low = ln.lower()
            entry = {"date": date, "amount": amount, "line": ln[:200], "file": p.name}
            if "artway" in low:
                artway.append(entry)
            elif "is a realtor" in low:
                israel.append(entry)
            elif any(k in low for k in ["weldon", "reno", "basement", "1l", "1r", "2r"]):
                other_prop.append(entry)

        if "PUBLIC SERVICE" in ln and "PSEG" in ln:
            am = re.search(r"PPD(-[\d,]+\.\d{2})", ln)
            if am:
                pseg.append(
                    {
                        "date": ln[:8],
                        "amount": abs(float(am.group(1).replace(",", ""))),
                        "line": ln[:160],
                        "file": p.name,
                    }
                )

print("\nARTWAY:")
for e in artway:
    print(e["date"], e["amount"], e["line"][30:120])
print("Artway total", round(sum(e["amount"] for e in artway), 2))

print("\nISRAEL / Is A Realtor:")
for e in israel:
    print(e["date"], e["amount"], e["line"][30:140])
print("Israel total", round(sum(e["amount"] for e in israel), 2))

print("\nARIEL INCOME (1L):")
for e in ariel_income:
    print(e["date"], e["amount"], e["line"][:120])
print("Ariel total", round(sum(e["amount"] for e in ariel_income), 2))

print("\nPSEG:")
by_month = {}
for e in pseg:
    key = e["date"][:5]  # rough
    by_month.setdefault(e["date"][:5], 0)
print("count", len(pseg), "total", round(sum(e["amount"] for e in pseg), 2))
# group by month
from collections import defaultdict

pm = defaultdict(float)
for e in pseg:
    # date MM/DD/YY
    mm, dd, yy = e["date"].split("/")
    pm[f"20{yy}-{mm}"] += e["amount"]
for k in sorted(pm):
    print(k, round(pm[k], 2))

print("\n=== BLUVINE ===")
airbnb = []
apts = []
seen_files = set()
for p in sorted(out.glob("*.txt")):
    if "blu" not in p.name.lower() and "blue" not in p.name.lower():
        continue
    # dedupe JuneBlueVine vs BluVine
    text = p.read_text(encoding="utf-8", errors="replace")
    # fingerprint
    fp = text[200:500]
    if fp in seen_files:
        print("skip dup", p.name)
        continue
    seen_files.add(fp)
    for ln in text.splitlines():
        ln = ln.strip()
        m = re.search(
            r"(\d{2}/\d{2}/\d{2})\s+(.*?)\s+\$([\d,]+\.\d{2})", ln
        )
        if not m:
            continue
        date, desc, amt = m.groups()
        amount = float(amt.replace(",", ""))
        if "AIRBNB" in desc.upper():
            airbnb.append({"date": date, "desc": desc, "amount": amount, "file": p.name})
        if "APARTMENT" in desc.upper() or "APTS" in desc.upper():
            apts.append({"date": date, "desc": desc, "amount": amount, "file": p.name})

print("Airbnb:")
for e in airbnb:
    print(e)
print("sum", round(sum(e["amount"] for e in airbnb), 2))
print("Apartments.com:")
for e in apts:
    print(e)
print("sum", round(sum(e["amount"] for e in apts), 2))
