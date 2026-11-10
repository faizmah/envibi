-- =============================================================================
-- NARAYAN VIRTUAL BANK — Seed Data
-- Data awal untuk pengujian dan inisialisasi lingkungan development
-- =============================================================================

-- Konfigurasi Default Bank
INSERT INTO public.bank_config (key, value) VALUES
  ('max_withdrawal_without_approval', '5000000'),
  ('min_deposit_amount', '10000'),
  ('max_deposit_amount', '100000000'),
  ('currency', '"IDR"'),
  ('bank_name', '"Narayan Virtual Bank"')
ON CONFLICT (key) DO NOTHING;

-- Catatan:
-- Akun user dibuat melalui Supabase Auth (Sign Up).
-- Untuk menetapkan role ADMIN pada user tertentu:
-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('<USER_UUID_FROM_AUTH_USERS>', 'ADMIN')
-- ON CONFLICT (user_id, role) DO NOTHING;

