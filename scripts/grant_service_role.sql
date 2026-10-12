-- Run this in the Supabase SQL Editor once to grant service_role update access:
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON TABLE public.administrative_units TO service_role;
