import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { supabase } from '../../services/supabase/client'
import { readNFCTag } from '../../services/nfc/nfcService'
import { formatRupiah, generateIdempotencyKey } from '../../utils/format'
import { Card, Button, Badge, Skeleton } from '../../components/ui'

const PRESET_AMOUNTS = [20000, 50000, 100000, 200000, 500000, 1000000]

export default function DepositPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1) // 1: Scan NFC, 2: Form Nominal, 3: Konfirmasi Fisik, 4: Berhasil
  const [account, setAccount] = useState(null)
  const [box, setBox] = useState(null)
  const [loading, setLoading] = useState(true)

  // Form states
  const [amount, setAmount] = useState(50000)
  const [notes, setNotes] = useState('')
  const [nfcScanning, setNfcScanning] = useState(false)
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
    setNfcScanning(true)
    setNfcMessage('Mendengarkan tag NFC... Dekatkan perangkat ke stiker NFC kotak tabungan Anda.')

    try {
      const result = await readNFCTag((p) => setNfcMessage(p.message))
      if (!result.ok) {
        setErrorMsg(result.error || 'Gagal membaca tag NFC.')
        return
      }

      setNfcMessage('Kotak tabungan terverifikasi melalui NFC!')
      setStep(2)
    } finally {
      setNfcScanning(false)
    }
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
      <div style={{ maxWidth: '640px', margin: '30px auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Skeleton height="36px" width="50%" />
        <Card variant="glass">
          <Skeleton height="20px" width="70%" style={{ marginBottom: '16px' }} />
          <Skeleton height="140px" style={{ marginBottom: '16px' }} />
          <Skeleton height="40px" />
        </Card>
      </div>
    )
  }

  if (!account) {
    return (
      <div style={{ maxWidth: '520px', margin: '40px auto', textAlign: 'center' }}>
        <Card variant="glass" style={{ padding: '36px 24px' }}>
          <div style={{ fontSize: '44px', marginBottom: '12px' }}>💳</div>
          <h3 style={{ margin: '0 0 8px', fontSize: '18px', color: 'var(--text-primary)' }}>Belum Ada Rekening Aktif</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px', lineHeight: '1.5' }}>
            Anda memerlukan rekening tabungan aktif sebelum dapat melakukan pencatatan setoran.
          </p>
          <Button variant="primary" to="/accounts/apply" style={{ width: '100%' }}>
            Ajukan Pembukaan Rekening ➔
          </Button>
        </Card>
      </div>
    )
  }

  const stepsList = [
    { num: 1, title: 'NFC Scan', icon: '📡' },
    { num: 2, title: 'Nominal', icon: '💵' },
    { num: 3, title: 'Fisik', icon: '📦' },
    { num: 4, title: 'Selesai', icon: '✨' },
  ]

  return (
    <div style={{ maxWidth: '640px', margin: '10px auto 40px' }}>
      {/* Page Title */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            TRANSAKSI MANDIRI
          </span>
          <Badge variant="success">Kotak Aktif</Badge>
        </div>
        <h1 style={{ fontSize: 'clamp(20px, 3vw, 24px)', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
          Setor Dana ke Kotak Fisik
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
          Rekening: <b style={{ color: '#d4a853' }}>{account.account_number}</b> • Saldo: <b style={{ color: '#10b981' }}>{formatRupiah(account.book_balance)}</b>
        </p>
      </div>

      {/* Progress Step Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '6px',
        marginBottom: '20px',
      }}>
        {stepsList.map((s) => {
          const isDone = step > s.num
          const isCurrent = step === s.num
          return (
            <div
              key={s.num}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '8px 4px',
                borderRadius: '10px',
                background: isCurrent
                  ? 'rgba(212,168,83,0.15)'
                  : isDone
                  ? 'rgba(16,185,129,0.12)'
                  : 'rgba(240,246,252,0.03)',
                border: isCurrent
                  ? '1px solid rgba(212,168,83,0.5)'
                  : isDone
                  ? '1px solid rgba(16,185,129,0.3)'
                  : '1px solid rgba(240,246,252,0.06)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{
                fontSize: '11px',
                fontWeight: '800',
                color: isCurrent ? '#d4a853' : isDone ? '#10b981' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span>{isDone ? '✓' : s.icon}</span>
                <span className="hide-mobile-sm">{s.title}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#f87171',
          fontSize: '12.5px',
          fontWeight: '600',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: SCAN NFC */}
      {step === 1 && (
        <Card variant="glass" style={{ padding: 'clamp(20px, 4vw, 36px)', textAlign: 'center' }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: nfcScanning
              ? 'radial-gradient(circle, rgba(16,185,129,0.3) 0%, rgba(16,185,129,0.05) 70%)'
              : 'rgba(212,168,83,0.1)',
            border: nfcScanning ? '2px solid #10b981' : '2px solid rgba(212,168,83,0.3)',
            display: 'grid',
            placeItems: 'center',
            fontSize: '32px',
            margin: '0 auto 16px',
            boxShadow: nfcScanning ? '0 0 24px rgba(16,185,129,0.4)' : 'none',
            transition: 'all 0.3s ease',
            animation: nfcScanning ? 'pulse 1.5s infinite' : 'none',
          }}>
            📡
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 8px', color: 'var(--text-primary)' }}>
            Verifikasi Kotak Tabungan NFC
          </h2>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '13px',
            maxWidth: '440px',
            margin: '0 auto 20px',
            lineHeight: '1.6',
          }}>
            Dekatkan smartphone Anda ke stiker/tag NFC pada kotak tabungan fisik untuk menjamin transaksi diarahkan ke kotak Anda yang sah.
          </p>

          {nfcMessage && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.25)',
              color: '#34d399',
              fontSize: '12px',
              fontWeight: '700',
              marginBottom: '20px',
            }}>
              {nfcMessage}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '340px', margin: '0 auto' }}>
            <Button
              variant="primary"
              size="lg"
              onClick={handleScanNFC}
              disabled={nfcScanning}
              loading={nfcScanning}
            >
              {nfcScanning ? 'Mendengarkan NFC...' : '📡 Pindai Tag NFC Kotak'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(2)}
              style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}
            >
              Lewati / Mode Input Manual (Tanpa NFC) ➔
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2: ISI NOMINAL SETORAN */}
      {step === 2 && (
        <Card variant="glass" style={{ padding: 'clamp(20px, 4vw, 32px)' }}>
          <form onSubmit={handleSubmitDepositReport} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Nominal Setoran Tunai (Rp)
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: '800',
                  color: '#d4a853',
                  fontSize: '16px',
                }}>Rp</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  min="10000"
                  step="5000"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elevated, #161b22)',
                    color: 'var(--text-primary, #f0f6fc)',
                    fontSize: '20px',
                    fontWeight: '800',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#d4a853'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#10b981', fontWeight: '700' }}>
                Terbilang: {formatRupiah(amount)}
              </div>
            </div>

            {/* Quick Amount Chips */}
            <div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                Pilihan Nominal Cepat:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {PRESET_AMOUNTS.map((amt) => {
                  const isSelected = amount === amt
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount(amt)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: isSelected ? '1px solid #d4a853' : '1px solid var(--border)',
                        background: isSelected ? 'rgba(212,168,83,0.18)' : 'rgba(240,246,252,0.04)',
                        color: isSelected ? '#d4a853' : 'var(--text-secondary)',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {formatRupiah(amt)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Catatan Setoran (Opsional)
              </label>
              <input
                type="text"
                placeholder="Misal: Uang sisa belanja mingguan, uang bonus"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elevated, #161b22)',
                  color: 'var(--text-primary, #f0f6fc)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '10px' }}>
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                ← Pindai Ulang
              </Button>
              <Button type="submit" variant="primary" loading={processing} disabled={processing}>
                {processing ? 'Memproses...' : 'Lanjut ke Konfirmasi Fisik →'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* STEP 3: KONFIRMASI FISIK */}
      {step === 3 && (
        <Card variant="glass" style={{ padding: 'clamp(20px, 4vw, 32px)' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(212,168,83,0.12), rgba(16,185,129,0.06))',
            border: '1px solid rgba(212,168,83,0.3)',
            padding: '18px',
            borderRadius: '14px',
            marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <h4 style={{ margin: 0, color: '#d4a853', fontSize: '15px', fontWeight: '800' }}>
                Konfirmasi Memasukkan Uang Fisik
              </h4>
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              Sistem self-saving berbasis kejujuran dan audit fisik. Pastikan Anda telah benar-benar memasukkan lembaran uang senilai <b style={{ color: '#10b981' }}>{formatRupiah(amount)}</b> ke dalam kotak tabungan fisik sebelum menekan tombol di bawah.
            </p>
          </div>

          <div style={{
            background: 'rgba(240,246,252,0.03)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nomor Transaksi:</span>
              <b style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{pendingTx?.transaction_number}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nominal Setoran:</span>
              <b style={{ color: '#10b981', fontSize: '16px' }}>{formatRupiah(amount)}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Catatan:</span>
              <span style={{ color: 'var(--text-secondary)' }}>{notes || 'Setoran mandiri'}</span>
            </div>
          </div>

          <Button
            type="button"
            variant="success"
            size="lg"
            onClick={handleConfirmPhysicalCash}
            loading={processing}
            disabled={processing}
            style={{ width: '100%', padding: '14px' }}
          >
            {processing ? 'Memperbarui Saldo...' : '✅ Saya Sudah Memasukkan Uang ke Kotak'}
          </Button>
        </Card>
      )}

      {/* STEP 4: BERHASIL */}
      {step === 4 && (
        <Card variant="glass" style={{ padding: 'clamp(24px, 5vw, 44px)', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(16,185,129,0.15)',
            border: '2px solid rgba(16,185,129,0.4)',
            display: 'grid',
            placeItems: 'center',
            fontSize: '32px',
            margin: '0 auto 16px',
          }}>
            🎉
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 8px', color: '#10b981' }}>
            Setoran Berhasil Dicatat!
          </h2>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '13px',
            maxWidth: '440px',
            margin: '0 auto 24px',
            lineHeight: '1.6',
          }}>
            Saldo rekening tabungan Anda telah berhasil diperbarui secara atomik. Mutasi dan jejak audit telah tersimpan permanen di database Narayan Virtual Bank.
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" to="/dashboard">
              📊 Buka Dashboard
            </Button>
            <Button variant="outline" to="/transactions">
              📜 Riwayat Transaksi
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
