-- =============================================================================
-- NARAYAN VIRTUAL BANK — Migration 001: Schema Foundation
-- Jalankan migration ini di Supabase SQL Editor atau via supabase CLI
-- =============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLE: profiles
-- Data profil member; terhubung 1:1 dengan auth.users
-- =============================================================================
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  phone           TEXT,
  address         TEXT,
  birth_date      DATE,
  avatar_url      TEXT,
  identity_number TEXT,  -- Nomor KTP/identitas
  identity_type   TEXT DEFAULT 'KTP',
  verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED'
    CHECK (verification_status IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Profil member; satu baris per user Supabase Auth';

-- =============================================================================
-- TABLE: user_roles
-- Role-based access control
-- =============================================================================
CREATE TABLE public.user_roles (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'MEMBER'
    CHECK (role IN ('MEMBER', 'ADMIN', 'SUPER_ADMIN')),
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

COMMENT ON TABLE public.user_roles IS 'Role pengguna; hanya dapat diubah melalui fungsi backend';

-- =============================================================================
-- TABLE: account_applications
-- Pengajuan pembukaan rekening oleh member
-- =============================================================================
CREATE TABLE public.account_applications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type    TEXT NOT NULL DEFAULT 'TABUNGAN'
    CHECK (account_type IN ('TABUNGAN', 'REGULER', 'BISNIS')),
  status          TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','UNDER_REVIEW','REVISION_REQUIRED','APPROVED','REJECTED')),
  initial_deposit NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (initial_deposit >= 0),
  notes           TEXT,
  admin_notes     TEXT,
  reviewed_by     UUID REFERENCES auth.users(id),
  reviewed_at     TIMESTAMPTZ,
  account_id      UUID,  -- diisi setelah disetujui (FK ke accounts)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_account_applications_user ON public.account_applications(user_id);
CREATE INDEX idx_account_applications_status ON public.account_applications(status);

-- =============================================================================
-- TABLE: accounts
-- Rekening tabungan member
-- =============================================================================
CREATE TABLE public.accounts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_number TEXT NOT NULL UNIQUE,  -- dibuat oleh backend, format: NVB-YYYYMMDD-NNNNNN
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  account_type   TEXT NOT NULL DEFAULT 'TABUNGAN'
    CHECK (account_type IN ('TABUNGAN', 'REGULER', 'BISNIS')),
  status         TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','CLOSED')),
  currency       TEXT NOT NULL DEFAULT 'IDR',
  book_balance   NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (book_balance >= 0),
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_user ON public.accounts(user_id);
CREATE INDEX idx_accounts_number ON public.accounts(account_number);

-- =============================================================================
-- TABLE: savings_boxes
-- Kotak tabungan fisik milik member
-- =============================================================================
CREATE TABLE public.savings_boxes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  box_code        TEXT NOT NULL UNIQUE,  -- kode unik kotak, format: BOX-NNNNNN
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  account_id      UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'PREPARING'
    CHECK (status IN ('PREPARING','NFC_PENDING','READY_TO_SHIP','SHIPPED','RECEIVED','ACTIVE','SUSPENDED','REPLACED')),
  description     TEXT,
  created_by      UUID REFERENCES auth.users(id),
  prepared_at     TIMESTAMPTZ,
  shipped_at      TIMESTAMPTZ,
  received_at     TIMESTAMPTZ,
  activated_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_savings_boxes_user ON public.savings_boxes(user_id);
CREATE INDEX idx_savings_boxes_account ON public.savings_boxes(account_id);
CREATE INDEX idx_savings_boxes_status ON public.savings_boxes(status);

-- =============================================================================
-- TABLE: nfc_tags
-- Data tag NFC untuk setiap kotak tabungan
-- =============================================================================
CREATE TABLE public.nfc_tags (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  box_id        UUID NOT NULL REFERENCES public.savings_boxes(id) ON DELETE CASCADE,
  -- public_token: token acak yang ditulis ke NFC (plaintext untuk NDEF URL)
  -- Ini bukan data sensitif; validasi kepemilikan dilakukan di backend
  public_token  TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  -- tag_uid: UID fisik tag NFC jika tersedia (opsional, bisa null)
  tag_uid       TEXT,
  status        TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','WRITTEN','VERIFIED','REPLACED','DEACTIVATED')),
  written_at    TIMESTAMPTZ,
  verified_at   TIMESTAMPTZ,
  replaced_at   TIMESTAMPTZ,
  written_by    UUID REFERENCES auth.users(id),
  verified_by   UUID REFERENCES auth.users(id),
  ndef_url      TEXT,  -- URL yang ditulis ke tag
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nfc_tags_box ON public.nfc_tags(box_id);
CREATE INDEX idx_nfc_tags_token ON public.nfc_tags(public_token);

-- =============================================================================
-- TABLE: shipments
-- Informasi pengiriman kotak tabungan
-- =============================================================================
CREATE TABLE public.shipments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  box_id          UUID NOT NULL REFERENCES public.savings_boxes(id) ON DELETE CASCADE,
  courier         TEXT,
  tracking_number TEXT,
  status          TEXT NOT NULL DEFAULT 'PREPARING'
    CHECK (status IN ('PREPARING','SHIPPED','IN_TRANSIT','DELIVERED','RETURNED')),
  sent_by         UUID REFERENCES auth.users(id),
  shipped_at      TIMESTAMPTZ,
  estimated_arrival TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipments_box ON public.shipments(box_id);

-- =============================================================================
-- TABLE: transactions
-- Semua transaksi tabungan
-- =============================================================================
CREATE TABLE public.transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_number TEXT NOT NULL UNIQUE,  -- format: TRX-YYYYMMDD-NNNNNN
  account_id        UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  box_id            UUID REFERENCES public.savings_boxes(id),
  transaction_type  TEXT NOT NULL
    CHECK (transaction_type IN ('DEPOSIT','WITHDRAWAL','ADJUSTMENT','OPENING','CORRECTION')),
  amount            NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  status            TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION'
    CHECK (status IN ('PENDING_CONFIRMATION','CONFIRMED','PROCESSING','COMPLETED','REJECTED','FAILED','CANCELLED')),
  description       TEXT,
  idempotency_key   TEXT UNIQUE,  -- mencegah transaksi ganda
  source            TEXT DEFAULT 'MEMBER_APP',  -- 'MEMBER_APP', 'NFC', 'ADMIN'
  physical_confirmed BOOLEAN DEFAULT FALSE,  -- apakah member sudah konfirmasi uang fisik
  physical_confirmed_at TIMESTAMPTZ,
  admin_note        TEXT,
  processed_by      UUID REFERENCES auth.users(id),
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at      TIMESTAMPTZ,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_account ON public.transactions(account_id);
CREATE INDEX idx_transactions_user ON public.transactions(user_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_number ON public.transactions(transaction_number);
CREATE INDEX idx_transactions_idempotency ON public.transactions(idempotency_key);

-- =============================================================================
-- TABLE: ledger_entries
-- Catatan mutasi pembukuan (double-entry)
-- =============================================================================
CREATE TABLE public.ledger_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id  UUID NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT,
  account_id      UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  entry_type      TEXT NOT NULL CHECK (entry_type IN ('DEBIT','CREDIT')),
  amount          NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  balance_after   NUMERIC(18,2) NOT NULL CHECK (balance_after >= 0),
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_account ON public.ledger_entries(account_id);
CREATE INDEX idx_ledger_transaction ON public.ledger_entries(transaction_id);

-- Ledger tidak boleh dihapus atau diubah
CREATE RULE no_delete_ledger AS ON DELETE TO public.ledger_entries DO INSTEAD NOTHING;
CREATE RULE no_update_ledger AS ON UPDATE TO public.ledger_entries DO INSTEAD NOTHING;

-- =============================================================================
-- TABLE: physical_balance_reports
-- Laporan saldo fisik dari member (rekonsiliasi)
-- =============================================================================
CREATE TABLE public.physical_balance_reports (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id           UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  box_id               UUID REFERENCES public.savings_boxes(id),
  user_id              UUID NOT NULL REFERENCES auth.users(id),
  reported_balance     NUMERIC(18,2) NOT NULL CHECK (reported_balance >= 0),
  book_balance_snapshot NUMERIC(18,2) NOT NULL,  -- saldo pembukuan saat laporan dibuat
  difference_amount    NUMERIC(18,2) GENERATED ALWAYS AS (reported_balance - book_balance_snapshot) STORED,
  status               TEXT NOT NULL DEFAULT 'REPORTED'
    CHECK (status IN ('REPORTED','ACKNOWLEDGED','INVESTIGATED','RESOLVED')),
  notes                TEXT,
  admin_response       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_physical_reports_account ON public.physical_balance_reports(account_id);
CREATE INDEX idx_physical_reports_user ON public.physical_balance_reports(user_id);

-- =============================================================================
-- TABLE: savings_goals
-- Target tabungan member
-- =============================================================================
CREATE TABLE public.savings_goals (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id     UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  target_amount  NUMERIC(18,2) NOT NULL CHECK (target_amount > 0),
  target_date    DATE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  achieved_at    TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_savings_goals_user ON public.savings_goals(user_id);

-- =============================================================================
-- TABLE: notifications
-- Notifikasi untuk member dan admin
-- =============================================================================
CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,  -- 'ACCOUNT_APPROVED', 'BOX_SHIPPED', 'TRANSACTION_COMPLETED', dll.
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB DEFAULT '{}',
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = FALSE;

-- =============================================================================
-- TABLE: audit_logs
-- Riwayat aktivitas penting sistem
-- =============================================================================
CREATE TABLE public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL,  -- 'ACCOUNT_APPROVED', 'NFC_WRITTEN', 'TRANSACTION_PROCESSED', dll.
  entity_type TEXT,  -- 'account', 'transaction', 'savings_box', 'nfc_tag'
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  metadata    JSONB DEFAULT '{}',  -- IP address, user agent, dll.
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Audit log tidak boleh dihapus atau diubah
CREATE RULE no_delete_audit AS ON DELETE TO public.audit_logs DO INSTEAD NOTHING;
CREATE RULE no_update_audit AS ON UPDATE TO public.audit_logs DO INSTEAD NOTHING;

-- =============================================================================
-- TABLE: bank_config
-- Konfigurasi operasional bank
-- =============================================================================
CREATE TABLE public.bank_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default config
INSERT INTO public.bank_config (key, value) VALUES
  ('max_withdrawal_without_approval', '5000000'),
  ('min_deposit_amount', '10000'),
  ('max_deposit_amount', '100000000'),
  ('currency', '"IDR"'),
  ('bank_name', '"Narayan Virtual Bank"');

-- =============================================================================
-- TRIGGERS: updated_at auto-update
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_account_applications_updated_at
  BEFORE UPDATE ON public.account_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_savings_boxes_updated_at
  BEFORE UPDATE ON public.savings_boxes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_nfc_tags_updated_at
  BEFORE UPDATE ON public.nfc_tags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_physical_reports_updated_at
  BEFORE UPDATE ON public.physical_balance_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_savings_goals_updated_at
  BEFORE UPDATE ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_shipments_updated_at
  BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- TRIGGER: Auto-create profile on user signup
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'MEMBER');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

