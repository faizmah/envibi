-- =============================================================================
-- NARAYAN VIRTUAL BANK — Migration 003: Database Functions (RPC)
-- Semua operasi keuangan penting dilakukan melalui fungsi ini
-- dengan validasi dan otorisasi yang tepat di sisi backend.
-- =============================================================================

-- =============================================================================
-- FUNCTION: generate_account_number
-- Membuat nomor rekening unik, format: NVB-YYYYMMDD-NNNNNN
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generate_account_number()
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  seq_num INT;
  result TEXT;
BEGIN
  prefix := 'NVB-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
  
  SELECT COUNT(*) + 1 INTO seq_num
  FROM public.accounts
  WHERE account_number LIKE prefix || '%';
  
  result := prefix || LPAD(seq_num::TEXT, 6, '0');
  
  -- Pastikan tidak duplikat
  WHILE EXISTS (SELECT 1 FROM public.accounts WHERE account_number = result) LOOP
    seq_num := seq_num + 1;
    result := prefix || LPAD(seq_num::TEXT, 6, '0');
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: generate_transaction_number
-- Membuat nomor transaksi unik
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generate_transaction_number()
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  seq_num INT;
  result TEXT;
BEGIN
  prefix := 'TRX-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
  
  SELECT COUNT(*) + 1 INTO seq_num
  FROM public.transactions
  WHERE transaction_number LIKE prefix || '%';
  
  result := prefix || LPAD(seq_num::TEXT, 6, '0');
  
  WHILE EXISTS (SELECT 1 FROM public.transactions WHERE transaction_number = result) LOOP
    seq_num := seq_num + 1;
    result := prefix || LPAD(seq_num::TEXT, 6, '0');
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: generate_box_code
-- Membuat kode kotak tabungan unik
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generate_box_code()
RETURNS TEXT AS $$
DECLARE
  seq_num INT;
  result TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO seq_num FROM public.savings_boxes;
  result := 'BOX-' || LPAD(seq_num::TEXT, 6, '0');
  
  WHILE EXISTS (SELECT 1 FROM public.savings_boxes WHERE box_code = result) LOOP
    seq_num := seq_num + 1;
    result := 'BOX-' || LPAD(seq_num::TEXT, 6, '0');
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- RPC: approve_account_application
-- Admin menyetujui pengajuan rekening dan membuat rekening baru
-- =============================================================================
CREATE OR REPLACE FUNCTION public.approve_account_application(
  p_application_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_app public.account_applications%ROWTYPE;
  v_account_number TEXT;
  v_account_id UUID;
  v_admin_id UUID := auth.uid();
BEGIN
  -- Validasi admin
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Akses ditolak: diperlukan role admin');
  END IF;
  
  -- Ambil data aplikasi
  SELECT * INTO v_app FROM public.account_applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pengajuan tidak ditemukan');
  END IF;
  
  IF v_app.status NOT IN ('PENDING', 'UNDER_REVIEW', 'REVISION_REQUIRED') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pengajuan sudah diproses sebelumnya');
  END IF;
  
  -- Buat nomor rekening
  v_account_number := public.generate_account_number();
  
  -- Buat rekening baru
  INSERT INTO public.accounts (
    account_number, user_id, account_type, status, book_balance, created_by
  ) VALUES (
    v_account_number, v_app.user_id, v_app.account_type, 'ACTIVE', 0, v_admin_id
  ) RETURNING id INTO v_account_id;
  
  -- Update aplikasi
  UPDATE public.account_applications SET
    status = 'APPROVED',
    admin_notes = p_admin_notes,
    reviewed_by = v_admin_id,
    reviewed_at = NOW(),
    account_id = v_account_id
  WHERE id = p_application_id;
  
  -- Audit log
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_data)
  VALUES (
    v_admin_id, 'ACCOUNT_APPLICATION_APPROVED', 'account_applications', p_application_id,
    jsonb_build_object('account_id', v_account_id, 'account_number', v_account_number)
  );
  
  -- Notifikasi ke member
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_app.user_id,
    'ACCOUNT_APPROVED',
    'Rekening Disetujui',
    'Rekening tabungan Anda telah disetujui. Nomor rekening: ' || v_account_number,
    jsonb_build_object('account_id', v_account_id, 'account_number', v_account_number)
  );
  
  RETURN jsonb_build_object(
    'ok', true,
    'account_id', v_account_id,
    'account_number', v_account_number
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RPC: reject_account_application
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reject_account_application(
  p_application_id UUID,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_app public.account_applications%ROWTYPE;
  v_admin_id UUID := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Akses ditolak');
  END IF;
  
  SELECT * INTO v_app FROM public.account_applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pengajuan tidak ditemukan');
  END IF;
  
  IF v_app.status IN ('APPROVED', 'REJECTED') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pengajuan sudah diputuskan');
  END IF;
  
  UPDATE public.account_applications SET
    status = 'REJECTED',
    admin_notes = p_reason,
    reviewed_by = v_admin_id,
    reviewed_at = NOW()
  WHERE id = p_application_id;
  
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_data)
  VALUES (v_admin_id, 'ACCOUNT_APPLICATION_REJECTED', 'account_applications', p_application_id,
    jsonb_build_object('reason', p_reason));
  
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (v_app.user_id, 'ACCOUNT_REJECTED', 'Pengajuan Rekening Ditolak',
    'Maaf, pengajuan rekening Anda ditolak. Alasan: ' || COALESCE(p_reason, '-'),
    jsonb_build_object('application_id', p_application_id));
  
  RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RPC: request_application_revision
-- =============================================================================
CREATE OR REPLACE FUNCTION public.request_application_revision(
  p_application_id UUID,
  p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_app public.account_applications%ROWTYPE;
  v_admin_id UUID := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Akses ditolak');
  END IF;
  
  SELECT * INTO v_app FROM public.account_applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pengajuan tidak ditemukan');
  END IF;
  
  UPDATE public.account_applications SET
    status = 'REVISION_REQUIRED',
    admin_notes = p_notes,
    reviewed_by = v_admin_id,
    reviewed_at = NOW()
  WHERE id = p_application_id;
  
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (v_app.user_id, 'REVISION_REQUIRED', 'Pengajuan Perlu Dilengkapi',
    'Pengajuan rekening Anda memerlukan perbaikan data. Catatan: ' || COALESCE(p_notes, '-'),
    jsonb_build_object('application_id', p_application_id));
  
  RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RPC: process_deposit
-- Memproses transaksi setoran dengan atomik
-- =============================================================================
CREATE OR REPLACE FUNCTION public.process_deposit(
  p_account_id UUID,
  p_box_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_account public.accounts%ROWTYPE;
  v_box public.savings_boxes%ROWTYPE;
  v_transaction_id UUID;
  v_transaction_number TEXT;
  v_new_balance NUMERIC;
  v_user_id UUID := auth.uid();
BEGIN
  -- Cek idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transaction_id FROM public.transactions
    WHERE idempotency_key = p_idempotency_key AND status = 'COMPLETED';
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'transaction_id', v_transaction_id);
    END IF;
  END IF;
  
  -- Validasi akun
  SELECT * INTO v_account FROM public.accounts WHERE id = p_account_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rekening tidak ditemukan');
  END IF;
  
  IF v_account.user_id != v_user_id AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Anda tidak memiliki akses ke rekening ini');
  END IF;
  
  IF v_account.status != 'ACTIVE' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rekening tidak aktif');
  END IF;
  
  -- Validasi nominal
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nominal harus lebih besar dari 0');
  END IF;
  
  IF p_amount < 10000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Minimal setoran Rp 10.000');
  END IF;
  
  -- Validasi kotak jika disertakan
  IF p_box_id IS NOT NULL THEN
    SELECT * INTO v_box FROM public.savings_boxes WHERE id = p_box_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Kotak tabungan tidak ditemukan');
    END IF;
    IF v_box.account_id != p_account_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Kotak tidak terhubung dengan rekening ini');
    END IF;
    IF v_box.status != 'ACTIVE' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Kotak tabungan tidak aktif');
    END IF;
  END IF;
  
  -- Hitung saldo baru
  v_new_balance := v_account.book_balance + p_amount;
  v_transaction_number := public.generate_transaction_number();
  
  -- Buat transaksi
  INSERT INTO public.transactions (
    transaction_number, account_id, user_id, box_id,
    transaction_type, amount, status, description, idempotency_key,
    source, physical_confirmed, submitted_at
  ) VALUES (
    v_transaction_number, p_account_id, v_user_id, p_box_id,
    'DEPOSIT', p_amount, 'PENDING_CONFIRMATION', p_description, p_idempotency_key,
    CASE WHEN p_box_id IS NOT NULL THEN 'NFC' ELSE 'MEMBER_APP' END,
    FALSE, NOW()
  ) RETURNING id INTO v_transaction_id;
  
  -- Audit log
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'DEPOSIT_SUBMITTED', 'transactions', v_transaction_id,
    jsonb_build_object('amount', p_amount, 'account_id', p_account_id));
  
  RETURN jsonb_build_object(
    'ok', true,
    'transaction_id', v_transaction_id,
    'transaction_number', v_transaction_number,
    'status', 'PENDING_CONFIRMATION'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RPC: confirm_physical_deposit
-- Member mengonfirmasi bahwa uang fisik sudah dimasukkan ke kotak
-- =============================================================================
CREATE OR REPLACE FUNCTION public.confirm_physical_deposit(
  p_transaction_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_account public.accounts%ROWTYPE;
  v_new_balance NUMERIC;
  v_user_id UUID := auth.uid();
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Transaksi tidak ditemukan');
  END IF;
  
  -- Hanya pemilik akun yang bisa konfirmasi
  IF v_tx.user_id != v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Akses ditolak');
  END IF;
  
  IF v_tx.status != 'PENDING_CONFIRMATION' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Transaksi tidak dalam status menunggu konfirmasi');
  END IF;
  
  IF v_tx.transaction_type != 'DEPOSIT' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Hanya transaksi setoran yang dapat dikonfirmasi dengan cara ini');
  END IF;
  
  -- Ambil rekening
  SELECT * INTO v_account FROM public.accounts WHERE id = v_tx.account_id FOR UPDATE;
  
  v_new_balance := v_account.book_balance + v_tx.amount;
  
  -- Update saldo rekening (atomik)
  UPDATE public.accounts SET book_balance = v_new_balance WHERE id = v_tx.account_id;
  
  -- Update status transaksi
  UPDATE public.transactions SET
    status = 'COMPLETED',
    physical_confirmed = TRUE,
    physical_confirmed_at = NOW(),
    confirmed_at = NOW(),
    processed_at = NOW()
  WHERE id = p_transaction_id;
  
  -- Buat ledger entry
  INSERT INTO public.ledger_entries (transaction_id, account_id, entry_type, amount, balance_after, description)
  VALUES (p_transaction_id, v_tx.account_id, 'CREDIT', v_tx.amount, v_new_balance, 'Setoran dikonfirmasi');
  
  -- Audit log
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (v_user_id, 'DEPOSIT_CONFIRMED', 'transactions', p_transaction_id,
    jsonb_build_object('balance_before', v_account.book_balance),
    jsonb_build_object('balance_after', v_new_balance, 'amount', v_tx.amount));
  
  -- Notifikasi
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (v_tx.user_id, 'DEPOSIT_COMPLETED', 'Setoran Berhasil',
    'Setoran Rp ' || TO_CHAR(v_tx.amount, 'FM999,999,999,999') || ' berhasil dicatat.',
    jsonb_build_object('transaction_id', p_transaction_id, 'amount', v_tx.amount, 'new_balance', v_new_balance));
  
  RETURN jsonb_build_object(
    'ok', true,
    'new_balance', v_new_balance,
    'transaction_id', p_transaction_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RPC: process_withdrawal
-- Memproses penarikan dengan validasi saldo
-- =============================================================================
CREATE OR REPLACE FUNCTION public.process_withdrawal(
  p_account_id UUID,
  p_box_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_account public.accounts%ROWTYPE;
  v_box public.savings_boxes%ROWTYPE;
  v_transaction_id UUID;
  v_transaction_number TEXT;
  v_new_balance NUMERIC;
  v_user_id UUID := auth.uid();
  v_max_no_approval NUMERIC;
BEGIN
  -- Cek idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transaction_id FROM public.transactions
    WHERE idempotency_key = p_idempotency_key AND status IN ('COMPLETED', 'PROCESSING');
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'transaction_id', v_transaction_id);
    END IF;
  END IF;
  
  -- Ambil rekening (dengan lock)
  SELECT * INTO v_account FROM public.accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rekening tidak ditemukan');
  END IF;
  
  IF v_account.user_id != v_user_id AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Akses ditolak');
  END IF;
  
  IF v_account.status != 'ACTIVE' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rekening tidak aktif');
  END IF;
  
  -- Validasi nominal
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nominal harus lebih besar dari 0');
  END IF;
  
  -- Validasi saldo
  IF v_account.book_balance < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Saldo tidak mencukupi. Saldo tersedia: Rp ' || TO_CHAR(v_account.book_balance, 'FM999,999,999,999'));
  END IF;
  
  -- Validasi kotak
  IF p_box_id IS NOT NULL THEN
    SELECT * INTO v_box FROM public.savings_boxes WHERE id = p_box_id;
    IF v_box.account_id != p_account_id OR v_box.status != 'ACTIVE' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Kotak tabungan tidak valid');
    END IF;
  END IF;
  
  -- Cek apakah perlu persetujuan admin
  SELECT (value::NUMERIC) INTO v_max_no_approval
  FROM public.bank_config WHERE key = 'max_withdrawal_without_approval';
  
  v_new_balance := v_account.book_balance - p_amount;
  v_transaction_number := public.generate_transaction_number();
  
  -- Buat transaksi
  INSERT INTO public.transactions (
    transaction_number, account_id, user_id, box_id,
    transaction_type, amount, status, description, idempotency_key, source, submitted_at
  ) VALUES (
    v_transaction_number, p_account_id, v_user_id, p_box_id,
    'WITHDRAWAL', p_amount,
    CASE WHEN p_amount > COALESCE(v_max_no_approval, 5000000) THEN 'PENDING_CONFIRMATION' ELSE 'PENDING_CONFIRMATION' END,
    p_description, p_idempotency_key,
    CASE WHEN p_box_id IS NOT NULL THEN 'NFC' ELSE 'MEMBER_APP' END,
    NOW()
  ) RETURNING id INTO v_transaction_id;
  
  -- Update saldo langsung (penarikan dikonfirmasi member)
  UPDATE public.accounts SET book_balance = v_new_balance WHERE id = p_account_id;
  
  -- Update status transaksi
  UPDATE public.transactions SET
    status = 'COMPLETED',
    physical_confirmed = TRUE,
    physical_confirmed_at = NOW(),
    confirmed_at = NOW(),
    processed_at = NOW()
  WHERE id = v_transaction_id;
  
  -- Ledger entry
  INSERT INTO public.ledger_entries (transaction_id, account_id, entry_type, amount, balance_after, description)
  VALUES (v_transaction_id, p_account_id, 'DEBIT', p_amount, v_new_balance, 'Penarikan');
  
  -- Audit log
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (v_user_id, 'WITHDRAWAL_COMPLETED', 'transactions', v_transaction_id,
    jsonb_build_object('balance_before', v_account.book_balance),
    jsonb_build_object('balance_after', v_new_balance, 'amount', p_amount));
  
  -- Notifikasi
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (v_tx_user_id, 'WITHDRAWAL_COMPLETED', 'Penarikan Berhasil',
    'Penarikan Rp ' || TO_CHAR(p_amount, 'FM999,999,999,999') || ' berhasil dicatat.',
    jsonb_build_object('transaction_id', v_transaction_id, 'amount', p_amount, 'new_balance', v_new_balance));
  
  RETURN jsonb_build_object(
    'ok', true,
    'transaction_id', v_transaction_id,
    'transaction_number', v_transaction_number,
    'new_balance', v_new_balance
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RPC: verify_nfc_token
-- Memverifikasi token NFC dan mengembalikan informasi kotak
-- Dipanggil ketika member scan NFC
-- =============================================================================
CREATE OR REPLACE FUNCTION public.verify_nfc_token(
  p_public_token TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_tag public.nfc_tags%ROWTYPE;
  v_box public.savings_boxes%ROWTYPE;
  v_account public.accounts%ROWTYPE;
  v_user_id UUID := auth.uid();
BEGIN
  -- Cari tag berdasarkan token
  SELECT * INTO v_tag FROM public.nfc_tags WHERE public_token = p_public_token AND status = 'VERIFIED';
  IF NOT FOUND THEN
    -- Cek apakah token ada tapi belum diverifikasi
    SELECT * INTO v_tag FROM public.nfc_tags WHERE public_token = p_public_token;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Token NFC tidak terdaftar dalam sistem');
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'Tag NFC belum diverifikasi oleh admin');
  END IF;
  
  -- Ambil data kotak
  SELECT * INTO v_box FROM public.savings_boxes WHERE id = v_tag.box_id;
  IF NOT FOUND OR v_box.status != 'ACTIVE' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kotak tabungan tidak aktif');
  END IF;
  
  -- Validasi kepemilikan (kecuali admin)
  IF v_box.user_id != v_user_id AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Token NFC ini bukan milik akun Anda');
  END IF;
  
  -- Ambil data rekening
  SELECT * INTO v_account FROM public.accounts WHERE id = v_box.account_id;
  IF NOT FOUND OR v_account.status != 'ACTIVE' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rekening terkait tidak aktif');
  END IF;
  
  RETURN jsonb_build_object(
    'ok', true,
    'box_id', v_box.id,
    'box_code', v_box.box_code,
    'account_id', v_account.id,
    'account_number', v_account.account_number,
    'book_balance', v_account.book_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RPC: activate_savings_box
-- Member mengaktifkan kotak setelah scan NFC konfirmasi penerimaan
-- =============================================================================
CREATE OR REPLACE FUNCTION public.activate_savings_box(
  p_box_id UUID,
  p_nfc_token TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_box public.savings_boxes%ROWTYPE;
  v_tag public.nfc_tags%ROWTYPE;
  v_user_id UUID := auth.uid();
BEGIN
  -- Verifikasi token
  SELECT * INTO v_tag FROM public.nfc_tags WHERE public_token = p_nfc_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Token NFC tidak valid');
  END IF;
  
  -- Ambil kotak
  SELECT * INTO v_box FROM public.savings_boxes WHERE id = p_box_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kotak tidak ditemukan');
  END IF;
  
  -- Pastikan kotak milik user ini
  IF v_box.user_id != v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kotak ini bukan milik Anda');
  END IF;
  
  -- Pastikan tag terhubung ke kotak ini
  IF v_tag.box_id != p_box_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Token NFC tidak cocok dengan kotak ini');
  END IF;
  
  -- Jika kotak sudah aktif
  IF v_box.status = 'ACTIVE' THEN
    RETURN jsonb_build_object('ok', true, 'box_id', p_box_id, 'status', 'ACTIVE', 'message', 'Kotak tabungan sudah aktif sebelumnya');
  END IF;

  -- Izinkan aktivasi untuk status yang wajar sebelum aktif (termasuk READY_TO_SHIP setelah NFC ditulis)
  IF v_box.status NOT IN ('READY_TO_SHIP', 'SHIPPED', 'RECEIVED', 'NFC_PENDING', 'PREPARING') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Status kotak saat ini (' || v_box.status || ') tidak memungkinkan aktivasi');
  END IF;
  
  -- Aktifkan kotak
  UPDATE public.savings_boxes SET
    status = 'ACTIVE',
    received_at = COALESCE(received_at, NOW()),
    activated_at = NOW()
  WHERE id = p_box_id;
  
  -- Audit log
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'BOX_ACTIVATED', 'savings_boxes', p_box_id,
    jsonb_build_object('nfc_token', LEFT(p_nfc_token, 8) || '...'));
  
  -- Notifikasi admin
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT u.id, 'BOX_ACTIVATED_BY_MEMBER', 'Kotak Diaktifkan Member',
    'Member telah mengaktifkan kotak ' || v_box.box_code,
    jsonb_build_object('box_id', p_box_id, 'box_code', v_box.box_code, 'member_id', v_user_id)
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.role IN ('ADMIN', 'SUPER_ADMIN');
  
  RETURN jsonb_build_object('ok', true, 'box_id', p_box_id, 'status', 'ACTIVE');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RPC: get_member_dashboard_data
-- Mengambil semua data yang dibutuhkan dashboard member dalam satu query
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_member_dashboard_data(
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := COALESCE(p_user_id, auth.uid());
  v_result JSONB;
BEGIN
  -- Validasi akses
  IF v_user_id != auth.uid() AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Akses ditolak');
  END IF;
  
  SELECT jsonb_build_object(
    'ok', true,
    'profile', (SELECT row_to_json(p) FROM public.profiles p WHERE p.id = v_user_id),
    'accounts', (
      SELECT jsonb_agg(row_to_json(a))
      FROM public.accounts a
      WHERE a.user_id = v_user_id AND a.status != 'CLOSED'
    ),
    'active_boxes', (
      SELECT jsonb_agg(row_to_json(sb))
      FROM public.savings_boxes sb
      WHERE sb.user_id = v_user_id AND sb.status = 'ACTIVE'
    ),
    'recent_transactions', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT * FROM public.transactions
        WHERE user_id = v_user_id
        ORDER BY created_at DESC
        LIMIT 10
      ) t
    ),
    'pending_applications', (
      SELECT jsonb_agg(row_to_json(aa))
      FROM public.account_applications aa
      WHERE aa.user_id = v_user_id AND aa.status NOT IN ('APPROVED', 'REJECTED')
    ),
    'unread_notification_count', (
      SELECT COUNT(*) FROM public.notifications
      WHERE user_id = v_user_id AND is_read = FALSE
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RPC: get_admin_dashboard_data
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_data()
RETURNS JSONB AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Akses ditolak');
  END IF;
  
  RETURN jsonb_build_object(
    'ok', true,
    'total_members', (SELECT COUNT(*) FROM public.profiles),
    'total_active_accounts', (SELECT COUNT(*) FROM public.accounts WHERE status = 'ACTIVE'),
    'pending_applications', (SELECT COUNT(*) FROM public.account_applications WHERE status IN ('PENDING','UNDER_REVIEW')),
    'preparing_boxes', (SELECT COUNT(*) FROM public.savings_boxes WHERE status IN ('PREPARING','NFC_PENDING','READY_TO_SHIP')),
    'shipped_boxes', (SELECT COUNT(*) FROM public.savings_boxes WHERE status = 'SHIPPED'),
    'active_boxes', (SELECT COUNT(*) FROM public.savings_boxes WHERE status = 'ACTIVE'),
    'total_book_balance', (SELECT COALESCE(SUM(book_balance), 0) FROM public.accounts WHERE status = 'ACTIVE'),
    'total_deposits_today', (
      SELECT COALESCE(SUM(amount), 0) FROM public.transactions
      WHERE transaction_type = 'DEPOSIT' AND status = 'COMPLETED'
      AND processed_at >= CURRENT_DATE
    ),
    'total_withdrawals_today', (
      SELECT COALESCE(SUM(amount), 0) FROM public.transactions
      WHERE transaction_type = 'WITHDRAWAL' AND status = 'COMPLETED'
      AND processed_at >= CURRENT_DATE
    ),
    'pending_transactions', (
      SELECT COUNT(*) FROM public.transactions WHERE status = 'PENDING_CONFIRMATION'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RPC: mark_notification_read
-- =============================================================================
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.notifications SET is_read = TRUE, read_at = NOW()
  WHERE id = p_notification_id AND user_id = auth.uid();
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RPC: mark_all_notifications_read
-- =============================================================================
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.notifications SET is_read = TRUE, read_at = NOW()
  WHERE user_id = auth.uid() AND is_read = FALSE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Fix typo in process_withdrawal function
-- =============================================================================
CREATE OR REPLACE FUNCTION public.process_withdrawal(
  p_account_id UUID,
  p_box_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_account public.accounts%ROWTYPE;
  v_box public.savings_boxes%ROWTYPE;
  v_transaction_id UUID;
  v_transaction_number TEXT;
  v_new_balance NUMERIC;
  v_user_id UUID := auth.uid();
  v_max_no_approval NUMERIC;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transaction_id FROM public.transactions
    WHERE idempotency_key = p_idempotency_key AND status IN ('COMPLETED', 'PROCESSING');
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'transaction_id', v_transaction_id);
    END IF;
  END IF;
  
  SELECT * INTO v_account FROM public.accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rekening tidak ditemukan');
  END IF;
  
  IF v_account.user_id != v_user_id AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Akses ditolak');
  END IF;
  
  IF v_account.status != 'ACTIVE' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rekening tidak aktif');
  END IF;
  
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nominal harus lebih besar dari 0');
  END IF;
  
  IF v_account.book_balance < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Saldo tidak mencukupi. Saldo: Rp ' || TO_CHAR(v_account.book_balance, 'FM999,999,999,999'));
  END IF;
  
  IF p_box_id IS NOT NULL THEN
    SELECT * INTO v_box FROM public.savings_boxes WHERE id = p_box_id;
    IF NOT FOUND OR v_box.account_id != p_account_id OR v_box.status != 'ACTIVE' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Kotak tabungan tidak valid');
    END IF;
  END IF;
  
  v_new_balance := v_account.book_balance - p_amount;
  v_transaction_number := public.generate_transaction_number();
  
  INSERT INTO public.transactions (
    transaction_number, account_id, user_id, box_id,
    transaction_type, amount, status, description, idempotency_key, source, submitted_at
  ) VALUES (
    v_transaction_number, p_account_id, v_user_id, p_box_id,
    'WITHDRAWAL', p_amount, 'COMPLETED', p_description, p_idempotency_key,
    CASE WHEN p_box_id IS NOT NULL THEN 'NFC' ELSE 'MEMBER_APP' END,
    NOW()
  ) RETURNING id INTO v_transaction_id;
  
  UPDATE public.accounts SET book_balance = v_new_balance WHERE id = p_account_id;
  
  UPDATE public.transactions SET
    physical_confirmed = TRUE,
    physical_confirmed_at = NOW(),
    confirmed_at = NOW(),
    processed_at = NOW()
  WHERE id = v_transaction_id;
  
  INSERT INTO public.ledger_entries (transaction_id, account_id, entry_type, amount, balance_after, description)
  VALUES (v_transaction_id, p_account_id, 'DEBIT', p_amount, v_new_balance, COALESCE(p_description, 'Penarikan'));
  
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (v_user_id, 'WITHDRAWAL_COMPLETED', 'transactions', v_transaction_id,
    jsonb_build_object('balance_before', v_account.book_balance),
    jsonb_build_object('balance_after', v_new_balance, 'amount', p_amount));
  
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (v_user_id, 'WITHDRAWAL_COMPLETED', 'Penarikan Berhasil',
    'Penarikan Rp ' || TO_CHAR(p_amount, 'FM999,999,999,999') || ' berhasil dicatat.',
    jsonb_build_object('transaction_id', v_transaction_id, 'amount', p_amount, 'new_balance', v_new_balance));
  
  RETURN jsonb_build_object(
    'ok', true,
    'transaction_id', v_transaction_id,
    'transaction_number', v_transaction_number,
    'new_balance', v_new_balance
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

