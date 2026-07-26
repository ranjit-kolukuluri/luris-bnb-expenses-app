-- Seed Luris BnB property after both partners have signed up.
-- Replace OWNER_USER_ID and PARTNER_USER_ID with auth.users ids from Authentication → Users.

-- Example:
-- select id, email from auth.users;

do $$
declare
  pid uuid := gen_random_uuid();
  owner_id uuid := 'OWNER_USER_ID'::uuid;
  partner_id uuid := 'PARTNER_USER_ID'::uuid;
  u_1l uuid;
  u_1r uuid;
  u_2l uuid;
  u_2r uuid;
  cat_down uuid;
  cat_closing uuid;
  cat_mortgage uuid;
  cat_water uuid;
  cat_utils uuid;
  cat_mgmt uuid;
  cat_reno uuid;
  cat_rent uuid;
begin
  insert into public.properties (
    id, name, address_line, city, state, zip, purchase_date,
    sale_price, loan_amount, interest_rate,
    monthly_pi, monthly_mi, monthly_escrow, monthly_mortgage_total
  ) values (
    pid,
    'Luris BnB',
    '16 Weldon St',
    'Jersey City',
    'NJ',
    '07306',
    '2026-02-09',
    885000.00,
    840750.00,
    6.3750,
    5245.19,
    301.27,
    991.46,
    6537.92
  );

  insert into public.property_members (property_id, user_id, role) values
    (pid, owner_id, 'owner'),
    (pid, partner_id, 'partner');

  insert into public.units (property_id, code, label, beds, baths, rental_model, sort_order)
  values
    (pid, '1L', '1L — 1 bed / 1 bath', 1, 1, 'flexible', 1),
    (pid, '1R', '1R — 3 bed / 1 bath', 3, 1, 'flexible', 2),
    (pid, '2L', '2L — 1 bed / 1 bath', 1, 1, 'long_term', 3),
    (pid, '2R', '2R — 1 bed / 1 bath', 1, 1, 'airbnb', 4);

  select id into u_1l from public.units where property_id = pid and code = '1L';
  select id into u_1r from public.units where property_id = pid and code = '1R';
  select id into u_2l from public.units where property_id = pid and code = '2L';
  select id into u_2r from public.units where property_id = pid and code = '2R';

  insert into public.categories (id, property_id, name, kind, cadence, sort_order) values
    (gen_random_uuid(), pid, 'Down Payment', 'expense', 'one_time', 1),
    (gen_random_uuid(), pid, 'Closing Costs', 'expense', 'one_time', 2),
    (gen_random_uuid(), pid, 'Inspection', 'expense', 'one_time', 3),
    (gen_random_uuid(), pid, 'Renovation', 'expense', 'one_time', 4),
    (gen_random_uuid(), pid, 'Monthly Mortgage', 'expense', 'recurring', 5),
    (gen_random_uuid(), pid, 'Water Bill', 'expense', 'recurring', 6),
    (gen_random_uuid(), pid, 'Utilities', 'expense', 'recurring', 7),
    (gen_random_uuid(), pid, 'Property Management', 'expense', 'recurring', 8),
    (gen_random_uuid(), pid, 'Rent / Airbnb', 'income', 'recurring', 9);

  select id into cat_down from public.categories where property_id = pid and name = 'Down Payment';
  select id into cat_closing from public.categories where property_id = pid and name = 'Closing Costs';
  select id into cat_mortgage from public.categories where property_id = pid and name = 'Monthly Mortgage';
  select id into cat_water from public.categories where property_id = pid and name = 'Water Bill';
  select id into cat_utils from public.categories where property_id = pid and name = 'Utilities';
  select id into cat_mgmt from public.categories where property_id = pid and name = 'Property Management';
  select id into cat_reno from public.categories where property_id = pid and name = 'Renovation';
  select id into cat_rent from public.categories where property_id = pid and name = 'Rent / Airbnb';

  -- From LENDER FINAL CD (Closing Disclosure) — Feb 9, 2026
  insert into public.transactions (
    property_id, category_id, type, cadence, title, description, amount, occurred_on, payment_account, vendor, is_seeded, created_by
  ) values
    (pid, cat_down, 'expense', 'one_time', 'Down Payment',
     'Purchase equity: sale price $885,000 − loan $840,750. Earnest deposit $7,500 applied toward cash to close.',
     44250.00, '2026-02-09', null, 'Tomo Mortgage / Seller', true, owner_id),
    (pid, cat_closing, 'expense', 'one_time', 'Closing Costs (Borrower-Paid)',
     'Total closing costs $16,834.77 from CD: loan costs $6,455.67 + other costs $10,629.10 − lender credits $250. Cash to close was $53,917.89.',
     16834.77, '2026-02-09', null, 'Blue Waters Title LLC', true, owner_id),
    (pid, cat_closing, 'expense', 'one_time', 'Tax Proration (Seller Prepaid)',
     'City/town taxes 02/09/26–04/01/26 due from borrower at closing (CD Section K.08).',
     1313.12, '2026-02-09', null, 'Hudson County', true, owner_id),
    (pid, cat_mortgage, 'expense', 'recurring', 'Monthly Mortgage (PITI)',
     'P&I $5,245.19 + MI $301.27 + escrow $991.46 = $6,537.92. 30-year fixed @ 6.375%.',
     6537.92, '2026-03-01', 'Chase', 'Tomo Mortgage / Chase', true, owner_id);

  -- Renovation placeholders by unit (amounts to fill as you enter receipts)
  insert into public.transactions (
    property_id, unit_id, category_id, type, cadence, title, description, amount, occurred_on, is_seeded, created_by
  ) values
    (pid, u_2r, cat_reno, 'expense', 'one_time', 'Renovation — 2R', 'Placeholder — update with actual spend from statements/screenshots.', 0, '2026-03-01', true, owner_id),
    (pid, u_1r, cat_reno, 'expense', 'one_time', 'Renovation — 1R', 'Placeholder — update with actual spend from statements/screenshots.', 0, '2026-03-01', true, owner_id),
    (pid, u_1l, cat_reno, 'expense', 'one_time', 'Renovation — 1L', 'Placeholder — update with actual spend from statements/screenshots.', 0, '2026-03-01', true, owner_id),
    (pid, null, cat_reno, 'expense', 'one_time', 'Renovation — Basement', 'Placeholder — cleanup and fixtures.', 0, '2026-03-01', true, owner_id);

  raise notice 'Seeded property id: %', pid;
end $$;
