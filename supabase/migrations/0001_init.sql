create extension if not exists "uuid-ossp";

create table albums (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  icloud_album_token text not null,
  owner_user_id uuid not null references auth.users(id),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create type album_role as enum ('owner', 'member');

create table album_members (
  album_id uuid not null references albums(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role album_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (album_id, user_id)
);

create type location_source as enum ('manual', 'ai_accepted');

create table photos (
  album_id uuid not null references albums(id) on delete cascade,
  photo_guid text not null,
  date_created timestamptz,
  caption text,
  media_asset_type text,
  thumb_url text,
  full_url text,
  latitude double precision,
  longitude double precision,
  location_source location_source,
  location_label text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (album_id, photo_guid)
);

create type suggestion_status as enum ('pending', 'accepted', 'rejected');

create table ai_suggestions (
  album_id uuid not null,
  photo_guid text not null,
  suggested_lat double precision not null,
  suggested_lng double precision not null,
  suggested_label text,
  reasoning text,
  status suggestion_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (album_id, photo_guid),
  foreign key (album_id, photo_guid) references photos(album_id, photo_guid) on delete cascade
);

create table city_themes (
  city_label text primary key,
  color_1 text not null,
  color_2 text not null,
  color_3 text not null,
  reasoning text,
  created_at timestamptz not null default now()
);

alter table albums enable row level security;
alter table album_members enable row level security;
alter table photos enable row level security;
alter table ai_suggestions enable row level security;
alter table city_themes enable row level security;

create or replace function is_album_member(target_album_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from album_members
    where album_id = target_album_id and user_id = auth.uid()
  );
$$;

create policy "members can read their albums"
  on albums for select
  using (is_album_member(id) or owner_user_id = auth.uid());

create policy "authenticated users can create albums"
  on albums for insert
  with check (owner_user_id = auth.uid());

create policy "owner can update album"
  on albums for update
  using (owner_user_id = auth.uid());

create policy "members can read membership rows for their albums"
  on album_members for select
  using (is_album_member(album_id));

create policy "owner can insert the first membership row"
  on album_members for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from albums where id = album_id and owner_user_id = auth.uid())
  );

create policy "members can read photos"
  on photos for select
  using (is_album_member(album_id));

create policy "members can insert photos"
  on photos for insert
  with check (is_album_member(album_id));

create policy "members can update photos"
  on photos for update
  using (is_album_member(album_id));

create policy "members can read ai_suggestions"
  on ai_suggestions for select
  using (is_album_member(album_id));

create policy "members can write ai_suggestions"
  on ai_suggestions for all
  using (is_album_member(album_id))
  with check (is_album_member(album_id));

create policy "authenticated users can read city themes"
  on city_themes for select
  to authenticated
  using (true);

create policy "authenticated users can insert city themes"
  on city_themes for insert
  to authenticated
  with check (true);

create or replace function join_album_via_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_album_id uuid;
begin
  select id into v_album_id from albums where invite_code = p_invite_code;

  if v_album_id is null then
    raise exception 'invalid_invite_code';
  end if;

  insert into album_members (album_id, user_id, role)
  values (v_album_id, auth.uid(), 'member')
  on conflict (album_id, user_id) do nothing;

  return v_album_id;
end;
$$;

grant execute on function join_album_via_invite(text) to authenticated;
grant execute on function is_album_member(uuid) to authenticated;
