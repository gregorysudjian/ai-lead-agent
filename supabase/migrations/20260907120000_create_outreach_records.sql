-- Outreach records: what we mean to say to a business, and what happened.
--
-- APPLICATION-OWNED IN FULL. Nothing here is provider content. Every column is
-- either our own words, our own workflow state, or a fact a human reported
-- after contacting the business. That is why this table may store an address
-- or a phone number at all: the value is copied here at draft time as the
-- contact WE chose to use, and its origin is recorded in the business profile
-- it came from.
--
-- No Google Places content is ever written here. Places terms permit storing a
-- place_id indefinitely and lat/lng for 30 days; name, address, phone, website
-- and rating must be requested live and not warehoused. Contacts written to
-- this table come from OpenStreetMap (ODbL) or from the business's own website,
-- both of which we may keep.
--
-- NOTHING IS SENT BY CODE. There is no send implementation anywhere in this
-- application. `status` and `sent_at` record what a PERSON did; they are not
-- side effects of a delivery attempt, and no worker reads this table to act on
-- it.
--
-- Unlike analyses, demo sites and business profiles, this table is MUTABLE: a
-- record moves from draft to approved to sent, and a human writes the outcome
-- afterwards. The grant below is therefore wider than the append-only tables --
-- and still no wider than the repository actually needs.

create table public.outreach_records (
  id uuid primary key,

  -- Our internal lead id, never a provider identifier. Cascades, because an
  -- outreach record about a deleted lead is an orphan with no subject.
  lead_id uuid not null references public.leads (id) on delete cascade,

  -- phone | email | social | in-person. Checked, so an unknown channel cannot
  -- be stored and silently mis-rendered.
  channel text not null
    check (channel in ('phone', 'email', 'social', 'in-person')),

  -- draft | approved | sent | replied | closed.
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'sent', 'replied', 'closed')),

  -- The contact we intend to use, copied when the draft was written.
  contact text check (contact is null or length(contact) <= 400),

  -- Email only; null for every other channel.
  subject text check (subject is null or length(subject) <= 300),

  -- Our own words. Bounded: a message, not a document.
  body text not null check (length(body) between 1 and 8000),

  -- What a human reports happened after they made contact.
  outcome text check (outcome is null or length(outcome) <= 4000),

  -- When a HUMAN recorded having sent this. Never set by a delivery path,
  -- because there is none.
  sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Newest first, per lead: the only read pattern the repository has.
create index outreach_records_lead_id_created_at_idx
  on public.outreach_records (lead_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Security, declared explicitly. Never inherited, never assumed.
-- ---------------------------------------------------------------------------

-- Start from nothing, including whatever default privileges may exist.
revoke all on table public.outreach_records from anon, authenticated, service_role;

-- Exactly the verbs the repository performs:
--   select  read records for a lead
--   insert  create a draft
--   update  change status, record an outcome, mark sent by hand
-- No delete: an outreach record is a log of what we did. Deleting one loses
-- the fact that a business was approached, which is the thing most worth
-- keeping -- including for honouring a request never to be contacted again.
grant select, insert, update on table public.outreach_records to service_role;

-- No sequence grant: `id` is an application-generated UUID and this table has
-- no sequence-backed column.

-- RLS on with NO policies. anon and authenticated can read and write nothing
-- even if a table grant were ever added by mistake. service_role bypasses RLS,
-- which is why its access is governed by the explicit grant above.
alter table public.outreach_records enable row level security;
