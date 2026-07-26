-- Fix history trigger: don't reference deleted_at on non-transaction tables
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
    if tg_table_name = 'transactions' then
      if (to_jsonb(old)->>'deleted_at') is null
         and (to_jsonb(new)->>'deleted_at') is not null then
        v_action := 'delete';
      elsif (to_jsonb(old)->>'deleted_at') is not null
         and (to_jsonb(new)->>'deleted_at') is null then
        v_action := 'restore';
      else
        v_action := 'update';
      end if;
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
    v_property_id := coalesce(
      (to_jsonb(new)->>'property_id')::uuid,
      (to_jsonb(old)->>'property_id')::uuid
    );
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

alter table public.transactions
  add column if not exists import_source text
  check (
    import_source is null
    or import_source in ('statement', 'live', 'manual')
  );

create table if not exists public.statement_coverage (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  account text not null,
  through_date date not null,
  label text not null,
  updated_at timestamptz not null default now(),
  unique (property_id, account)
);

alter table public.statement_coverage enable row level security;

create policy "Members manage statement coverage"
  on public.statement_coverage for all
  using (public.is_property_member(property_id))
  with check (public.is_property_member(property_id));
