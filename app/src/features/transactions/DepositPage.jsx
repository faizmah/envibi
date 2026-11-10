import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { supabase } from '../../services/supabase/client'
import { readNFCTag, isNFCSupported } from '../../services/nfc/nfcService'
import { formatRupiah, generateIdempotencyKey } from '../../utils/format'

export default function DepositPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [step, setStep] = useState(1) // 1: Scan NFC, 2: Form Nominal, 3: Konfirmasi Fisik, 4: Berhasil
  const [account, setAccount] = useState(null)
  const [box, setBox] = useState(null)
  const [loading, setLoading] = useState(true)

  // Form states
  const paramAmount = searchParams.get('amount')
  const [amount, setAmount] = useState(paramAmount ? Number(paramAmount) : 50000)
  const [notes, setNotes] = useState('')
  const [nfcScanned, setNfcScanned] = useState(false)
  const [scannedToken, setScannedToken] = useState('')
  const [nfcMessage, setNfcMessage] = useState('')

  // Processing state
  const [processing, setProcessing] = useState(false)
  const [pendingTx, setPendingTx] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function loadData() {
      if (!user) return
      setLoading(true)

      // Ambil rekening aktif
      const { data: accs } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .limit(1)

      if (accs && accs.length > 0) {
        setAccount(accs[0])

        // Ambil kotak aktif
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

  // Handle Scan NFC Kotak
  const handleScanNFC = async () => {
    setErrorMsg('')
    setNfcMessage('Mendengarkan tag NFC... Dekatkan HP ke kotak tabungan.')

    const result = await readNFCTag((p) => setNfcMessage(p.message))
    if (!result.ok) {
      setErrorMsg(result.error || 'Gagal membaca tag NFC.')
      return
    }

    setScannedToken(result.token)
    setNfcScanned(true)
    setNfcMessage('Kotak tabungan terverifikasi melalui NFC!')
    setStep(2)
  }

  // Submit initial deposit transaction (PENDING_CONFIRMATION)
  const handleSubmitDepositReport = async (e) => {
    e.preventDefault()
    if (!account) return

    if (amount < 10000) {
      setErrorMsg('Minimal setoran adalah Rp 10.000')
      return
    }

    setProcessing(true)
    setErrorMsg('')

    const idempotencyKey = generateIdempotencyKey()

    const { data, error } = await supabase.rpc('process_deposit', {
      p_account_id: account.id,
      p_box_id: box?.id || null,
      p_amount: Number(amount),
      p_description: notes.trim() || 'Setoran mandiri ke kotak tabungan',
      p_idempotency_key: idempotencyKey,
    })

    setProcessing(false)

    if (error || !data?.ok) {
      setErrorMsg(error?.message || data?.error || 'Gagal memproses setoran.')
      return
    }

    setPendingTx(data)
    setStep(3) // Lanjut ke konfirmasi fisik
  }

  // Step 3: Member confirms cash has physically been placed in the box
  const handleConfirmPhysicalCash = async () => {
    if (!pendingTx?.transaction_id) return

    setProcessing(true)
    setErrorMsg('')

    const { data, error } = await supabase.rpc('confirm_physical_deposit', {
      p_transaction_id: pendingTx.transaction_id,
    })

    setProcessing(false)

    if (error || !data?.ok) {
      setErrorMsg(error?.message || data?.error || 'Konfirmasi fisik gagal.')
      return
    }

    setStep(4) // Berhasil
  }

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--fg-muted)' }}>Memuat data setoran...</p>
      </div>
    )
  }

  if (!account) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <h3>Belum ada rekening aktif</h3>
        <p style={{ color: 'var(--fg-muted)' }}>Silakan buka rekening tabungan terlebih dahulu.</p>
        <Link to="/accounts/apply" className="btn btn-primary">Buka Rekening</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '680px', margin: '20px auto 60px', padding: '0 20px' }}>
      <div className="card">
        {/* Header Alur Setoran */}
        <div className="card-header" style={{ marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--accent2)', fontWeight: '800' }}>
              TRANSAKSI MANDIRI
            </span>
            <h2 style={{ margin: '4px 0', fontSize: '22px', fontWeight: '800' }}>
              Setor Tabungan ke Kotak Fisik
            </h2>
          </div>
          <span className="status good">Rekening: {account.account_number}</span>
        </div>

        {/* Multi-step Breadcrumb */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {['1. Pindai NFC', '2. Isi Nominal', '3. Konfirmasi Fisik', '4. Selesai'].map((title, i) => (
            <span
              key={title}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '800',
                background: step > i + 1 ? 'rgba(46, 204, 113, 0.2)' : step === i + 1 ? 'var(--accent)' : 'var(--section-bg)',
                color: step === i + 1 ? '#17212d' : step > i + 1 ? '#65d69a' : 'var(--fg-muted)',
              }}
            >
              {title}
            </span>
          ))}
        </div>

        {errorMsg && (
          <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(231, 76, 60, 0.18)', color: '#ff8a80', fontSize: '12px', fontWeight: '700', marginBottom: '16px' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* STEP 1: SCAN NFC */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📡</div>
              <h3 style={{ margin: '0 0 8px' }}>Tempelkan Perangkat ke Kotak Tabungan</h3>
              <p style={{ color: 'var(--fg-muted)', fontSize: '12px', maxWidth: '440px', margin: '0 auto 20px', lineHeight: '1.6' }}>
                Pindai tag NFC pada kotak tabungan fisik Anda untuk memastikan transaksi tercatat pada kotak yang tepat.
              </p>

              {nfcMessage && (
                <div style={{ color: 'var(--accent2)', fontWeight: '700', fontSize: '12px', marginBottom: '16px' }}>
                  {nfcMessage}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '360px', margin: '0 auto' }}>
                <button type="button" className="btn btn-primary" onClick={handleScanNFC} style={{ padding: '12px' }}>
                  📡 Mulai Pindai NFC Kotak
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setNfcScanned(true)
                    setStep(2)
                  }}
                  style={{ fontSize: '11px' }}
                >
                  Lanjut Tanpa NFC (Mode Manual)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: ISI NOMINAL SETORAN */}
        {step === 2 && (
          <form onSubmit={handleSubmitDepositReport} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="form-label">Nominal Uang yang Dimasukkan (Rp)</label>
              <input
                type="number"
                className="form-field"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                min="10000"
                step="10000"
                required
                style={{ fontSize: '18px', fontWeight: '800' }}
              />
              <small style={{ color: 'var(--fg-muted)', fontSize: '11px' }}>
                Nominal tertera: <b>{formatRupiah(amount)}</b>
              </small>
            </div>

            {/* Nominal Quick Buttons */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[20000, 50000, 100000, 200000, 500000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setAmount(amt)}
                >
                  {formatRupiah(amt)}
                </button>
              ))}
            </div>

            <div>
              <label className="form-label">Catatan Setoran (Opsional)</label>
              <input
                type="text"
                className="form-field"
                placeholder="Contoh: Uang sisa belanja mingguan"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                ← Kembali
              </button>
              <button type="submit" disabled={processing} className="btn btn-primary">
                {processing ? 'Membuat Laporan...' : 'Kirim Laporan Setoran →'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: KONFIRMASI FISIK */}
        {step === 3 && (
          <div>
            <div style={{ background: 'rgba(241, 196, 15, 0.1)', border: '1px solid rgba(241, 196, 15, 0.3)', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 6px', color: '#e8c75b' }}>⚠️ Verifikasi Masukkan Uang Fisik</h4>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--fg-muted)', lineHeight: '1.5' }}>
                Sistem pembukuan tabungan mandiri membutuhkan konfirmasi jujur. Pastikan Anda telah memasukkan uang fisik sejumlah <b>{formatRupiah(amount)}</b> ke dalam celengan/kotak tabungan Anda di rumah.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', background: 'var(--section-bg)', padding: '14px', borderRadius: '10px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--fg-muted)' }}>Nomor Transaksi:</span>
                <b>{pendingTx?.transaction_number}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--fg-muted)' }}>Nominal Setoran:</span>
                <b style={{ color: '#65d69a', fontSize: '16px' }}>{formatRupiah(amount)}</b>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-success btn-full"
              onClick={handleConfirmPhysicalCash}
              disabled={processing}
              style={{ padding: '14px', fontSize: '14px' }}
            >
              {processing ? 'Memproses Saldo...' : '✅ Saya Sudah Memasukkan Uang Fisik ke Kotak'}
            </button>
          </div>
        )}

        {/* STEP 4: BERHASIL */}
        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ fontSize: '50px', marginBottom: '12px' }}>🎉</div>
            <h3 style={{ margin: '0 0 8px', color: '#65d69a', fontSize: '20px' }}>Setoran Berhasil Dicatat!</h3>
            <p style={{ color: 'var(--fg-muted)', fontSize: '13px', maxWidth: '440px', margin: '0 auto 24px', lineHeight: '1.6' }}>
              Saldo pembukuan rekening Anda telah diperbarui secara atomik. Transaksi dan audit trail telah tersimpan aman di database.
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

