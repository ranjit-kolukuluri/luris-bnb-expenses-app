-- Luris BnB — core schema with entity relationships + change history
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------------
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address_line text not null,
  city text not null,
  state text not null,
  zip text not null,
  purchase_date date not null,
  sale_price numeric(12,2) not null,
  loan_amount numeric(12,2) not null,
  interest_rate numeric(6,4) not null,
  monthly_pi numeric(12,2) not null,
  monthly_mi numeric(12,2) not null default 0,
  monthly_escrow numeric(12,2) not null default 0,
  monthly_mortgage_total numeric(12,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Property membership (many users ↔ many properties)
-- ---------------------------------------------------------------------------
create table if not exists public.property_members (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'partner' check (role in ('owner', 'partner')),
  created_at timestamptz not null default now(),
  unique (property_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Units (belong to a property)
-- ---------------------------------------------------------------------------
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  code text not null,
  label text not null,
  beds int not null default 1,
  baths numeric(3,1) not null default 1,
  rental_model text not null default 'flexible',
  status text not null default 'active'
    check (status in ('active', 'under_renovation', 'vacant')),
  expected_monthly_rent numeric(12,2) not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, code)
);

-- ---------------------------------------------------------------------------
-- Categories (expense / income buckets per property)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('expense', 'income')),
  cadence text not null default 'one_time' check (cadence in ('one_time', 'recurring')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (property_id, name, kind)
);

-- ---------------------------------------------------------------------------
-- Transactions (ledger) — history preserved via soft delete + history table
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  unit_id uuid references public.units (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  type text not null check (type in ('expense', 'income')),
  cadence text not null default 'one_time' check (cadence in ('one_time', 'recurring')),
  title text not null,
  description text,
  amount numeric(12,2) not null,
  occurred_on date not null,
  applies_on date,
  payment_account text,
  vendor text,
  expense_group text
    check (
      expense_group is null
      or expense_group in (
        'contractor_fees',
        'materials',
        'interior_design',
        'property_management'
      )
    ),
  expense_subgroup text,
  is_seeded boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_transactions_property_date
  on public.transactions (property_id, occurred_on desc)
  where deleted_at is null;

create index if not exists idx_transactions_applies
  on public.transactions (property_id, applies_on)
  where deleted_at is null;

create index if not exists idx_transactions_unit
  on public.transactions (unit_id)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Documents (optional attachments)
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete set null,
  title text not null,
  file_path text not null,
  file_name text not null,
  mime_type text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Change history (immutable audit log)
-- ---------------------------------------------------------------------------
create table if not exists public.entity_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties (id) on delete cascade,
  entity_type text not null
    check (entity_type in ('property', 'unit', 'category', 'transaction', 'document', 'member')),
  entity_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete', 'restore')),
  old_row jsonb,
  new_row jsonb,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_entity_history_property
  on public.entity_history (property_id, changed_at desc);

create index if not exists idx_entity_history_entity
  on public.entity_history (entity_type, entity_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_properties_updated on public.properties;
create trigger trg_properties_updated
  before update on public.properties
  for each row execute function public.set_updated_at();

drop trigger if exists trg_units_updated on public.units;
create trigger trg_units_updated
  before update on public.units
  for each row execute function public.set_updated_at();

drop trigger if exists trg_transactions_updated on public.transactions;
create trigger trg_transactions_updated
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- History logging
-- ---------------------------------------------------------------------------
create or replace function public.log_entity_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property_id uuid;
  v_entity_id uuid;
  v_action text;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := 'insert';
    v_old := null;
    v_new := to_jsonb(new);
    v_entity_id := new.id;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_entity_id := new.id;
    if tg_table_name = 'transactions' and old.deleted_at is null and new.deleted_at is not null then
      v_action := 'delete';
    elsif tg_table_name = 'transactions' and old.deleted_at is not null and new.deleted_at is null then
      v_action := 'restore';
    else
      v_action := 'update';
    end if;
  elsif tg_op = 'DELETE' then
    v_action := 'delete';
    v_old := to_jsonb(old);
    v_new := null;
    v_entity_id := old.id;
  end if;

  if tg_table_name = 'properties' then
    v_property_id := coalesce(new.id, old.id);
  else
    v_property_id := coalesce(new.property_id, old.property_id);
  end if;

  insert into public.entity_history (
    property_id, entity_type, entity_id, action, old_row, new_row, changed_by
  ) values (
    v_property_id,
    case tg_table_name
      when 'properties' then 'property'
      when 'units' then 'unit'
      when 'categories' then 'category'
      when 'transactions' then 'transaction'
      when 'documents' then 'document'
      when 'property_members' then 'member'
      else tg_table_name
    end,
    v_entity_id,
    v_action,
    v_old,
    v_new,
    auth.uid()
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hist_properties on public.properties;
create trigger trg_hist_properties
  after insert or update or delete on public.properties
  for each row execute function public.log_entity_history();

drop trigger if exists trg_hist_units on public.units;
create trigger trg_hist_units
  after insert or update or delete on public.units
  for each row execute function public.log_entity_history();

drop trigger if exists trg_hist_categories on public.categories;
create trigger trg_hist_categories
  after insert or update or delete on public.categories
  for each row execute function public.log_entity_history();

drop trigger if exists trg_hist_transactions on public.transactions;
create trigger trg_hist_transactions
  after insert or update or delete on public.transactions
  for each row execute function public.log_entity_history();

drop trigger if exists trg_hist_documents on public.documents;
create trigger trg_hist_documents
  after insert or update or delete on public.documents
  for each row execute function public.log_entity_history();

drop trigger if exists trg_hist_members on public.property_members;
create trigger trg_hist_members
  after insert or update or delete on public.property_members
  for each row execute function public.log_entity_history();

-- ---------------------------------------------------------------------------
-- Auth profile bootstrap
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_property_member(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.property_members m
    where m.property_id = pid and m.user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_members enable row level security;
alter table public.units enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.documents enable row level security;
alter table public.entity_history enable row level security;

-- Profiles
create policy "Profiles are viewable by self"
  on public.profiles for select using (auth.uid() = id);
create policy "Profiles updatable by self"
  on public.profiles for update using (auth.uid() = id);

-- Properties
create policy "Members can view properties"
  on public.properties for select
  using (public.is_property_member(id));
create policy "Members can update properties"
  on public.properties for update
  using (public.is_property_member(id));
create policy "Authenticated users can create properties"
  on public.properties for insert
  with check (auth.uid() is not null);

-- Members
create policy "Members can view membership"
  on public.property_members for select
  using (public.is_property_member(property_id) or user_id = auth.uid());
create policy "Owners can add members"
  on public.property_members for insert
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.property_members m
      where m.property_id = property_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- Units / categories / transactions / documents / history
create policy "Members manage units"
  on public.units for all
  using (public.is_property_member(property_id))
  with check (public.is_property_member(property_id));

create policy "Members manage categories"
  on public.categories for all
  using (public.is_property_member(property_id))
  with check (public.is_property_member(property_id));

create policy "Members manage transactions"
  on public.transactions for all
  using (public.is_property_member(property_id))
  with check (public.is_property_member(property_id));

create policy "Members manage documents"
  on public.documents for all
  using (public.is_property_member(property_id))
  with check (public.is_property_member(property_id));

create policy "Members read history"
  on public.entity_history for select
  using (property_id is null or public.is_property_member(property_id));

-- Storage bucket for documents
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "Members can upload documents"
  on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid() is not null);

create policy "Members can read documents"
  on storage.objects for select
  using (bucket_id = 'documents' and auth.uid() is not null);

create policy "Members can delete own documents"
  on storage.objects for delete
  using (bucket_id = 'documents' and auth.uid() = owner);
