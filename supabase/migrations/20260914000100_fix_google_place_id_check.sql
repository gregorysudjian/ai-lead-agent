-- Fix the place id shape check added in 20260914000000_add_google_maps_check.
--
-- WHAT WENT WRONG. The check was `google_place_id ~ '^[A-Za-z0-9_-]{10,300}$'`.
-- Postgres regular expressions allow a repetition count of at most 255, so the
-- pattern itself is invalid -- but Postgres only compiles it when a row has a
-- non-null place id, so the migration applied cleanly and the first real write
-- failed with "invalid regular expression: invalid repetition count(s)".
--
-- THE FIX. The same rule, split in two so no count is needed: the allowed
-- characters by pattern, the length by char_length.
--
-- STRICT, like every migration here: no IF NOT EXISTS guards. No change to
-- grants or RLS.

alter table public.businesses
  drop constraint businesses_google_place_id_shape;

alter table public.businesses
  add constraint businesses_google_place_id_shape
    check (google_place_id ~ '^[A-Za-z0-9_-]+$' and char_length(google_place_id) between 10 and 300);

notify pgrst, 'reload schema';
