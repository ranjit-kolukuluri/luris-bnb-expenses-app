# Luris BnB

Mobile-first expense & income tracker for **16 Weldon St, Jersey City, NJ 07306** (closed Feb 9, 2026).

## Live

- **App:** [https://luris-bnb.vercel.app](https://luris-bnb.vercel.app)
- **Supabase:** project `luris-bnb` (`itxbmhldaxhtjtzvzihf`) in the same org as RUDR-AI

## Stack

- **Next.js 16** + TypeScript + Tailwind
- **PWA** (`manifest.webmanifest`)
- **Supabase** — relational ledger + `entity_history` audit trail + partner auth
- **Vercel** — production hosting

## Data model (relationships)

```
auth.users ──< profiles
     │
     └──< property_members >── properties
                                  ├──< units
                                  ├──< categories
                                  ├──< transactions >── documents
                                  └──< entity_history (immutable change log)
```

Every insert/update/delete on property, unit, category, transaction, document, and membership is logged in `entity_history`. Transactions use soft-delete (`deleted_at`) so history stays intact.

## Local

```bash
npm install
npm run dev
```

Copy `.env.example` → `.env.local` (already set if you linked the project).

## Seed / re-seed cloud

```bash
npm run seed:supabase
```

Uses the service role key from `.env.local` (never commit it).

## Partner sync

1. Open Settings → enter email → magic link
2. First partner clicks **Claim property & load shared ledger**
3. Partner signs up with their email, then owner invites them in Settings

## Deploy

```bash
npx vercel --prod
```
