import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { supabase } from '../../services/supabase/client'
import { readNFCTag } from '../../services/nfc/nfcService'
import { formatRupiah, generateIdempotencyKey } from '../../utils/format'

export default function WithdrawalPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1) // 1: Scan NFC, 2: Form Nominal & Validasi, 3: Selesai
  const [account, setAccount] = useState(null)
  const [box, setBox] = useState(null)
  const [loading, setLoading] = useState(true)

  const [amount, setAmount] = useState(50000)
  const [notes, setNotes] = useState('')
  const [scannedToken, setScannedToken] = useState('')
  const [nfcMessage, setNfcMessage] = useState('')

  const [processing, setProcessing] = useState(false)
  const [resultTx, setResultTx] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function loadData() {
      if (!user) return
      setLoading(true)

      const { data: accs } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .limit(1)

      if (accs && accs.length > 0) {
        setAccount(accs[0])

        const { data: boxes } = await supabase
          .from('savings_boxes')
          .select('*')
          .eq('account_id', accs[0].id)
          .eq('status', 'ACTIVE')
          .single()

        setBox(boxes || null)
      }

      setLoading(false)
    }

    loadData()
  }, [user])

  const handleScanNFC = async () => {
    setErrorMsg('')
    setNfcMessage('Mendengarkan tag NFC... Dekatkan perangkat ke kotak fisik.')

    const result = await readNFCTag((p) => setNfcMessage(p.message))
    if (!result.ok) {
      setErrorMsg(result.error || 'Gagal membaca tag NFC.')
      return
    }

    setScannedToken(result.token)
    setNfcMessage('Kotak fisik diverifikasi via NFC!')
    setStep(2)
  }

  const handleSubmitWithdrawal = async (e) => {
    e.preventDefault()
    if (!account) return

    if (amount <= 0) {
      setErrorMsg('Nominal penarikan harus lebih dari Rp 0.')
      return
    }

    if (amount > account.book_balance) {
      setErrorMsg(`Saldo tidak mencukupi. Saldo tersedia: ${formatRupiah(account.book_balance)}`)
      return
    }

    setProcessing(true)
    setErrorMsg('')

    const idempotencyKey = generateIdempotencyKey()

    const { data, error } = await supabase.rpc('process_withdrawal', {
      p_account_id: account.id,
      p_box_id: box?.id || null,
      p_amount: Number(amount),
      p_description: notes.trim() || 'Penarikan mandiri dari kotak fisik',
      p_idempotency_key: idempotencyKey,
    })

    setProcessing(false)

    if (error || !data?.ok) {
      setErrorMsg(error?.message || data?.error || 'Penarikan gagal diproses.')
      return
    }

    setResultTx(data)
    setStep(3) // Selesai
  }

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--fg-muted)' }}>Memuat data penarikan...</p>
      </div>
    )
  }

  if (!account) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <h3>Belum ada rekening aktif</h3>
        <Link to="/accounts/apply" className="btn btn-primary">Buka Rekening</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '680px', margin: '20px auto 60px', padding: '0 20px' }}>
      <div className="card">
        <div className="card-header" style={{ marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--accent2)', fontWeight: '800' }}>
              PENARIKAN MANDIRI
            </span>
            <h2 style={{ margin: '4px 0', fontSize: '22px', fontWeight: '800' }}>
              Tarik Uang dari Kotak Tabungan
            </h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: 'var(--fg-muted)', fontSize: '11px', display: 'block' }}>Saldo Tersedia:</span>
            <b style={{ color: 'var(--accent2)', fontSize: '15px' }}>{formatRupiah(account.book_balance)}</b>
          </div>
        </div>

        {errorMsg && (
          <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(231, 76, 60, 0.18)', color: '#ff8a80', fontSize: '12px', fontWeight: '700', marginBottom: '16px' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* STEP 1: SCAN NFC */}
        {step === 1 && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📡</div>
            <h3 style={{ margin: '0 0 8px' }}>Pindai Kotak Tabungan Terlebih Dahulu</h3>
            <p style={{ color: 'var(--fg-muted)', fontSize: '12px', maxWidth: '440px', margin: '0 auto 20px', lineHeight: '1.6' }}>
              Pastikan Anda berada di dekat kotak fisik untuk memvalidasi pengambilan uang tunai.
            </p>

            {nfcMessage && (
              <div style={{ color: 'var(--accent2)', fontWeight: '700', fontSize: '12px', marginBottom: '16px' }}>
                {nfcMessage}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '360px', margin: '0 auto' }}>
              <button type="button" className="btn btn-primary" onClick={handleScanNFC} style={{ padding: '12px' }}>
                📡 Pindai Tag NFC Kotak
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep(2)}
                style={{ fontSize: '11px' }}
              >
                Lanjut Tanpa NFC (Mode Darurat)
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: FORM PENARIKAN */}
        {step === 2 && (
          <form onSubmit={handleSubmitWithdrawal} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="form-label">Nominal Penarikan (Rp)</label>
              <input
                type="number"
                className="form-field"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                min="10000"
                max={account.book_balance}
                step="10000"
                required
                style={{ fontSize: '18px', fontWeight: '800' }}
              />
              <small style={{ color: 'var(--fg-muted)', fontSize: '11px' }}>
                Maksimal penarikan: <b>{formatRupiah(account.book_balance)}</b>
              </small>
            </div>

            <div>
              <label className="form-label">Keperluan Penarikan / Catatan</label>
              <input
                type="text"
                className="form-field"
                placeholder="Contoh: Belanja keperluan mendesak"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div style={{ background: 'rgba(231, 76, 60, 0.1)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(231, 76, 60, 0.25)', fontSize: '12px', color: '#ff8a80' }}>
              ⚠️ Dengan menekan tombol di bawah, Anda mengonfirmasi bahwa Anda telah mengambil uang tunai sejumlah <b>{formatRupiah(amount)}</b> dari kotak tabungan fisik Anda.
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                ← Pindai Ulang
              </button>
              <button type="submit" disabled={processing || amount > account.book_balance} className="btn btn-danger">
                {processing ? 'Memproses Penarikan...' : 'Ambil Uang & Perbarui Saldo'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: BERHASIL */}
        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ fontSize: '50px', marginBottom: '12px' }}>💸</div>
            <h3 style={{ margin: '0 0 8px', color: '#65d69a', fontSize: '20px' }}>Penarikan Berhasil Dicatat!</h3>
            <p style={{ color: 'var(--fg-muted)', fontSize: '13px', maxWidth: '440px', margin: '0 auto 24px', lineHeight: '1.6' }}>
              Transaksi #{resultTx?.transaction_number} telah diselesaikan. Saldo pembukuan terbaru Anda: <b>{formatRupiah(resultTx?.new_balance)}</b>.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <Link to="/dashboard" className="btn btn-primary">
                📊 Buka Dashboard
              </Link>
              <Link to="/transactions" className="btn btn-secondary">
                📜 Riwayat Transaksi
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

