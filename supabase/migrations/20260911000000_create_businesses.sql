-- The business catalog: every hair and beauty business on the island of
-- Montreal that we might one day approach, kept apart from the leads we have
-- decided to pursue.
--
-- WHY A SECOND TABLE RATHER THAN MORE ROWS IN public.leads. A lead is a
-- business the operator chose; it carries a status, research, an analysis,
-- demo sites and outreach. The catalog is refreshed automatically from open
-- data and holds thousands of businesses nobody has looked at. When search
-- wrote straight into leads, "the leads" became "whatever the last few
-- searches returned", and every repeat search reported that everything was
-- already a lead. A catalog row becomes a lead only when someone adds it.
--
-- SAME SHAPE AS A LEAD WHERE IT CAN BE. The provider snapshot is one jsonb
-- column, replaced wholesale on every refresh, and the dedupe helper columns
-- and their two unique indexes mirror public.leads exactly. A catalog row can
-- therefore be handed to the lead repository unchanged when it is added.
--
-- NOTHING IS EVER DELETED. A business the latest release no longer lists keeps
-- its row and simply stops being refreshed: last_seen_release falls behind.
-- The application shows it as "no longer listed", never as "closed" -- a
-- dataset dropping a place is not evidence that the business shut.
--
-- COORDINATES LIVE HERE AND NOWHERE ELSE. Overture and OpenStreetMap both
-- permit storing them. They are kept out of the lead's provider snapshot so
-- that Google's 30-day limit on caching coordinates can never reach a lead.
--
-- STRICT, like every migration here: no IF NOT EXISTS guards.
--
-- SECURITY, declared explicitly as CLAUDE.md requires.

create table public.businesses (
  id uuid primary key,

  -- The provider's latest snapshot, same shape as public.leads.provider.
  provider jsonb not null,

  -- Denormalised from `provider` so Postgres can enforce the dedupe rules the
  -- application applies. The mapping layer refuses a row where these disagree
  -- with the snapshot they were derived from.
  provider_source text not null,
  provider_external_id text not null,
  normalized_name text not null,
  normalized_address text,

  -- Ours: derived from the provider's locality by the area registry, so
  -- Verdun, Saint-Laurent and the rest file under Montréal for filtering.
  municipality text not null
    constraint businesses_municipality_not_blank check (char_length(municipality) > 0),

  latitude double precision
    constraint businesses_latitude_range check (latitude between -90 and 90),
  longitude double precision
    constraint businesses_longitude_range check (longitude between -180 and 180),

  -- When, and in which dataset release, this business was first and most
  -- recently seen. Release names are ISO dates, so they order as text.
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  first_seen_release text not null,
  last_seen_release text not null,

  -- The lead this business became. SET NULL rather than cascade: removing a
  -- lead must never remove the business from the catalog -- it goes back to
  -- being something the operator can find and add again.
  lead_id uuid references public.leads (id) on delete set null,

  constraint businesses_coordinates_paired check ((latitude is null) = (longitude is null)),
  constraint businesses_seen_in_order check (last_seen_at >= first_seen_at),
  constraint businesses_releases_in_order check (last_seen_release >= first_seen_release)
);

-- PRIMARY dedupe: same provider, same identifier.
create unique index businesses_provider_identity_idx
  on public.businesses (provider_source, provider_external_id);

-- SECONDARY dedupe: a business re-listed under a new provider id. PARTIAL on
-- purpose, exactly as on public.leads: a missing address means "unknown",
-- never "matches anything".
create unique index businesses_normalized_identity_idx
  on public.businesses (normalized_name, normalized_address)
  where normalized_address is not null;

-- One catalog row per lead. Two rows claiming one lead would show "In your
-- leads" beside a business the operator never chose.
create unique index businesses_lead_id_idx
  on public.businesses (lead_id)
  where lead_id is not null;

-- ---- Security ------------------------------------------------------------
--
-- Start from nothing for every API-facing role, including service_role.
revoke all on table public.businesses from anon, authenticated, service_role;

-- service_role receives ONLY what CatalogRepository performs: bulk insert and
-- refresh during a load (INSERT and UPDATE, which is what an upsert needs),
-- link a lead (UPDATE), and search (SELECT).
--
-- No DELETE. The catalog keeps every business it has ever recorded.
grant select, insert, update on table public.businesses to service_role;

-- No sequence grant: `id` is an application-generated UUID.

-- RLS enabled with NO policies. anon and authenticated reach nothing even if
-- a table grant were ever added by mistake.
alter table public.businesses enable row level security;

-- ---- Make the API see it -------------------------------------------------
--
-- Without this PostgREST keeps serving its start-up schema cache and reports
-- "PGRST205: could not find the table", which reads exactly like a migration
-- that never ran.
notify pgrst, 'reload schema';
