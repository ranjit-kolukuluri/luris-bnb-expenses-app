-- Claim the seeded property as owner when it has no members yet.
create or replace function public.claim_default_property()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
  member_count int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id into pid
  from public.properties
  order by created_at
  limit 1;

  if pid is null then
    raise exception 'No property found. Seed the database first.';
  end if;

  select count(*) into member_count
  from public.property_members
  where property_id = pid;

  if member_count = 0 then
    insert into public.property_members (property_id, user_id, role)
    values (pid, auth.uid(), 'owner')
    on conflict (property_id, user_id) do nothing;
  elsif not public.is_property_member(pid) then
    raise exception 'Property already has members. Ask an owner to invite you.';
  end if;

  return pid;
end;
$$;

grant execute on function public.claim_default_property() to authenticated;

-- Invite partner by email (owner only). Partner must already have signed up.
create or replace function public.invite_property_member(member_email text, member_role text default 'partner')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
  target_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if member_role not in ('owner', 'partner') then
    raise exception 'Invalid role';
  end if;

  select p.id into pid
  from public.properties p
  join public.property_members m on m.property_id = p.id
  where m.user_id = auth.uid() and m.role = 'owner'
  order by p.created_at
  limit 1;

  if pid is null then
    raise exception 'Only an owner can invite members';
  end if;

  select id into target_id
  from auth.users
  where lower(email) = lower(member_email)
  limit 1;

  if target_id is null then
    raise exception 'No user found for %. Ask them to sign up first.', member_email;
  end if;

  insert into public.property_members (property_id, user_id, role)
  values (pid, target_id, member_role)
  on conflict (property_id, user_id) do update set role = excluded.role;

  return target_id;
end;
$$;

grant execute on function public.invite_property_member(text, text) to authenticated;
