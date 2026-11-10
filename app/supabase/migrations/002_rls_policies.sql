-- =============================================================================
-- NARAYAN VIRTUAL BANK — Migration 002: Row Level Security (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_balance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_config ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- HELPER FUNCTION: Get current user's role
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_user_role(uid UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
  SELECT role FROM public.user_roles WHERE user_id = uid
  ORDER BY CASE role
    WHEN 'SUPER_ADMIN' THEN 1
    WHEN 'ADMIN' THEN 2
    ELSE 3
  END
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = uid AND role IN ('ADMIN', 'SUPER_ADMIN')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- =============================================================================
-- RLS: profiles
-- =============================================================================
CREATE POLICY "Member can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Member can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admin can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- =============================================================================
-- RLS: user_roles
-- =============================================================================
CREATE POLICY "User can view own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admin can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Only super admin can manage roles"
  ON public.user_roles FOR ALL
  USING (public.get_user_role() = 'SUPER_ADMIN');

-- =============================================================================
-- RLS: account_applications
-- =============================================================================
CREATE POLICY "Member can view own applications"
  ON public.account_applications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Member can create own applications"
  ON public.account_applications FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Member cannot update own applications directly"
  ON public.account_applications FOR UPDATE
  USING (FALSE);  -- Updates hanya via RPC

CREATE POLICY "Admin can view all applications"
  ON public.account_applications FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admin can update applications"
  ON public.account_applications FOR UPDATE
  USING (public.is_admin());

-- =============================================================================
-- RLS: accounts
-- =============================================================================
CREATE POLICY "Member can view own accounts"
  ON public.accounts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admin can view all accounts"
  ON public.accounts FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admin can create accounts"
  ON public.accounts FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin can update accounts"
  ON public.accounts FOR UPDATE
  USING (public.is_admin());

-- Member tidak dapat langsung mengubah saldo — harus via RPC
-- =============================================================================

-- =============================================================================
-- RLS: savings_boxes
-- =============================================================================
CREATE POLICY "Member can view own boxes"
  ON public.savings_boxes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admin can view all boxes"
  ON public.savings_boxes FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admin can manage boxes"
  ON public.savings_boxes FOR ALL
  USING (public.is_admin());

-- =============================================================================
-- RLS: nfc_tags
-- Member dapat membaca token NFC kotak miliknya (untuk verifikasi)
-- =============================================================================
CREATE POLICY "Member can view nfc tags for own boxes"
  ON public.nfc_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.savings_boxes sb
      WHERE sb.id = box_id AND sb.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin can manage all nfc tags"
  ON public.nfc_tags FOR ALL
  USING (public.is_admin());

-- =============================================================================
-- RLS: shipments
-- =============================================================================
CREATE POLICY "Member can view own shipments"
  ON public.shipments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.savings_boxes sb
      WHERE sb.id = box_id AND sb.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin can manage all shipments"
  ON public.shipments FOR ALL
  USING (public.is_admin());

-- =============================================================================
-- RLS: transactions
-- =============================================================================
CREATE POLICY "Member can view own transactions"
  ON public.transactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Member can create own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Member cannot update transactions directly"
  ON public.transactions FOR UPDATE
  USING (FALSE);  -- Hanya via RPC

CREATE POLICY "Admin can view all transactions"
  ON public.transactions FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admin can update transactions"
  ON public.transactions FOR UPDATE
  USING (public.is_admin());

-- =============================================================================
-- RLS: ledger_entries
-- =============================================================================
CREATE POLICY "Member can view own ledger entries"
  ON public.ledger_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin can view all ledger entries"
  ON public.ledger_entries FOR SELECT
  USING (public.is_admin());

-- Tidak ada update/delete policy — ledger tidak boleh diubah

-- =============================================================================
-- RLS: physical_balance_reports
-- =============================================================================
CREATE POLICY "Member can view own reports"
  ON public.physical_balance_reports FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Member can create own reports"
  ON public.physical_balance_reports FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can view all reports"
  ON public.physical_balance_reports FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admin can update reports"
  ON public.physical_balance_reports FOR UPDATE
  USING (public.is_admin());

-- =============================================================================
-- RLS: savings_goals
-- =============================================================================
CREATE POLICY "Member can manage own goals"
  ON public.savings_goals FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can view all goals"
  ON public.savings_goals FOR SELECT
  USING (public.is_admin());

-- =============================================================================
-- RLS: notifications
-- =============================================================================
CREATE POLICY "User can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "User can update own notifications (mark read)"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can create notifications for anyone"
  ON public.notifications FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (TRUE);  -- Functions dengan SECURITY DEFINER dapat insert

-- =============================================================================
-- RLS: audit_logs
-- =============================================================================
CREATE POLICY "Admin can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Member can view audit logs for own entities"
  ON public.audit_logs FOR SELECT
  USING (actor_id = auth.uid());

-- =============================================================================
-- RLS: bank_config
-- =============================================================================
CREATE POLICY "Anyone can read config"
  ON public.bank_config FOR SELECT
  USING (TRUE);

CREATE POLICY "Only super admin can update config"
  ON public.bank_config FOR UPDATE
  USING (public.get_user_role() = 'SUPER_ADMIN');

