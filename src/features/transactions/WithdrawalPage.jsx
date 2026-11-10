import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { supabase } from '../../services/supabase/client'
import { readNFCTag } from '../../services/nfc/nfcService'
import { formatRupiah, generateIdempotencyKey } from '../../utils/format'
import { Card, Button, Badge, Skeleton, Modal } from '../../components/ui'

const PRESET_AMOUNTS = [20000, 50000, 100000, 200000, 500000]

export default function WithdrawalPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1) // 1: Scan NFC, 2: Form Nominal & Validasi, 3: Selesai
  const [account, setAccount] = useState(null)
  const [box, setBox] = useState(null)
  const [loading, setLoading] = useState(true)

  const [amount, setAmount] = useState(50000)
  const [notes, setNotes] = useState('')
  const [nfcScanning, setNfcScanning] = useState(false)
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
    setNfcScanning(true)
    setNfcMessage('Mendengarkan tag NFC... Dekatkan smartphone ke kotak tabungan fisik Anda.')

    try {
      const result = await readNFCTag((p) => setNfcMessage(p.message))
      if (!result.ok) {
        setErrorMsg(result.error || 'Gagal membaca tag NFC.')
        return
      }

      setNfcMessage('Kotak fisik diverifikasi via NFC!')
      setStep(2)
    } finally {
      setNfcScanning(false)
    }
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
            Anda belum memiliki rekening tabungan aktif untuk ditarik saldonya.
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
    { num: 2, title: 'Nominal & Validasi', icon: '💵' },
    { num: 3, title: 'Selesai', icon: '✨' },
  ]

  return (
    <div style={{ maxWidth: '640px', margin: '10px auto 40px' }}>
      {/* Page Title */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            PENARIKAN MANDIRI
          </span>
          <Badge variant="warning">Otorisasi Fisik</Badge>
        </div>
        <h1 style={{ fontSize: 'clamp(20px, 3vw, 24px)', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
          Tarik Uang dari Kotak Tabungan
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
          Rekening: <b style={{ color: '#d4a853' }}>{account.account_number}</b> • Saldo Tersedia: <b style={{ color: '#10b981' }}>{formatRupiah(account.book_balance)}</b>
        </p>
      </div>

      {/* Progress Step Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
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
              ? 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, rgba(239,68,68,0.05) 70%)'
              : 'rgba(212,168,83,0.1)',
            border: nfcScanning ? '2px solid #f87171' : '2px solid rgba(212,168,83,0.3)',
            display: 'grid',
            placeItems: 'center',
            fontSize: '32px',
            margin: '0 auto 16px',
            boxShadow: nfcScanning ? '0 0 24px rgba(239,68,68,0.4)' : 'none',
            transition: 'all 0.3s ease',
          }}>
            📡
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 8px', color: 'var(--text-primary)' }}>
            Otorisasi Fisik via NFC Kotak
          </h2>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '13px',
            maxWidth: '440px',
            margin: '0 auto 20px',
            lineHeight: '1.6',
          }}>
            Untuk mencegah penarikan fiktif, pindai stiker NFC pada kotak tabungan Anda sebelum mengambil uang tunai.
          </p>

          {nfcMessage && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(212,168,83,0.1)',
              border: '1px solid rgba(212,168,83,0.25)',
              color: '#d4a853',
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
              {nfcScanning ? 'Mendengarkan NFC...' : '📡 Pindai NFC Kotak Tabungan'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(2)}
              style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}
            >
              Mode Penarikan Darurat (Tanpa NFC) ➔
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2: FORM PENARIKAN */}
      {step === 2 && (
        <Card variant="glass" style={{ padding: 'clamp(20px, 4vw, 32px)' }}>
          <form onSubmit={handleSubmitWithdrawal} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                  Nominal Penarikan (Rp)
                </label>
                <button
                  type="button"
                  onClick={() => setAmount(account.book_balance)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#d4a853',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Tarik Semua ({formatRupiah(account.book_balance)})
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: '800',
                  color: '#f87171',
                  fontSize: '16px',
                }}>Rp</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  min="10000"
                  max={account.book_balance}
                  step="5000"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    borderRadius: '12px',
                    border: amount > account.book_balance ? '1px solid #ef4444' : '1px solid var(--border)',
                    background: 'var(--bg-elevated, #161b22)',
                    color: 'var(--text-primary, #f0f6fc)',
                    fontSize: '20px',
                    fontWeight: '800',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#f87171'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '12px' }}>
                <span style={{ color: amount > account.book_balance ? '#ef4444' : '#10b981', fontWeight: '700' }}>
                  {amount > account.book_balance ? '❌ Melebihi saldo rekening' : `Terbilang: ${formatRupiah(amount)}`}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Sisa saldo: <b style={{ color: '#d4a853' }}>{formatRupiah(Math.max(0, account.book_balance - amount))}</b>
                </span>
              </div>
            </div>

            {/* Quick Amount Chips */}
            <div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                Pilihan Cepat:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {PRESET_AMOUNTS.filter(amt => amt <= account.book_balance).map((amt) => {
                  const isSelected = amount === amt
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount(amt)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: isSelected ? '1px solid #f87171' : '1px solid var(--border)',
                        background: isSelected ? 'rgba(239,68,68,0.18)' : 'rgba(240,246,252,0.04)',
                        color: isSelected ? '#f87171' : 'var(--text-secondary)',
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
                Keperluan Penarikan / Catatan
              </label>
              <input
                type="text"
                placeholder="Misal: Keperluan darurat, belanja kebutuhan harian"
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

            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '14px',
              borderRadius: '12px',
              fontSize: '12px',
              color: '#f87171',
              lineHeight: '1.5',
            }}>
              ⚠️ Dengan melanjutkan, Anda menyatakan bahwa uang tunai sebesar <b>{formatRupiah(amount)}</b> diambil langsung dari kotak tabungan fisik Anda dan pembukuan saldo sistem akan dikurangi secara permanen.
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '10px' }}>
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                ← Pindai Ulang
              </Button>
              <Button
                type="submit"
                variant="danger"
                loading={processing}
                disabled={processing || amount <= 0 || amount > account.book_balance}
              >
                {processing ? 'Memproses...' : 'Ambil Uang & Perbarui Saldo ➔'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* STEP 3: BERHASIL */}
      {step === 3 && (
        <Card variant="glass" style={{ padding: 'clamp(24px, 5vw, 44px)', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239,68,68,0.15)',
            border: '2px solid rgba(239,68,68,0.4)',
            display: 'grid',
            placeItems: 'center',
            fontSize: '32px',
            margin: '0 auto 16px',
          }}>
            💸
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 8px', color: '#f87171' }}>
            Penarikan Berhasil Dicatat!
          </h2>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '13px',
            maxWidth: '440px',
            margin: '0 auto 24px',
            lineHeight: '1.6',
          }}>
            Transaksi <b style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>#{resultTx?.transaction_number}</b> telah diselesaikan. Saldo pembukuan terbaru Anda adalah <b style={{ color: '#10b981' }}>{formatRupiah(resultTx?.new_balance)}</b>.
          </p>
        </Card>
      )}

      {/* Modal Sukses Tarik */}
      <Modal
        isOpen={step === 3}
        onClose={() => navigate('/dashboard')}
        title="Penarikan Berhasil Dicatat"
        maxWidth="440px"
      >
        <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid rgba(239, 68, 68, 0.4)',
            display: 'grid',
            placeItems: 'center',
            fontSize: '30px',
            margin: '0 auto 16px',
          }}>
            💸
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '800', color: '#f87171' }}>
            Penarikan Berhasil!
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', margin: '0 0 16px' }}>
            Uang tunai sejumlah <b style={{ color: '#f87171' }}>{formatRupiah(amount)}</b> telah ditarik dari kotak fisik.
          </p>

          <div style={{
            background: 'rgba(240, 246, 252, 0.03)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '12px',
            marginBottom: '20px',
            textAlign: 'left',
            fontSize: '12.5px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>No. Transaksi:</span>
              <b style={{ fontFamily: 'monospace' }}>{resultTx?.transaction_number}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Sisa Saldo Terkini:</span>
              <b style={{ color: '#10b981' }}>{formatRupiah(resultTx?.new_balance)}</b>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="outline" to="/transactions" style={{ flex: 1 }}>
              📜 Riwayat
            </Button>
            <Button variant="primary" to="/dashboard" style={{ flex: 1 }}>
              📊 Dashboard
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
