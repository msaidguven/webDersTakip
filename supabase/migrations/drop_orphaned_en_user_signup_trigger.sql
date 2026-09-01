-- create_user_daily_limit() was an AFTER INSERT trigger on auth.users that
-- inserted into en_users and en_user_daily_limit — two tables that no longer
-- exist in this database (confirmed: not referenced anywhere else in the DB
-- or in the webDersTakip codebase, likely leftovers from an unrelated,
-- removed feature). Because the trigger ran inside the same transaction as
-- the auth.users insert, every new user creation — email/password signup AND
-- first-time Google sign-in — failed with a 500 "Database error creating new
-- user", since the trigger's INSERTs errored on the missing tables and rolled
-- back the whole signup.

DROP TRIGGER IF EXISTS after_auth_user_signup ON auth.users;
DROP FUNCTION IF EXISTS public.create_user_daily_limit();
