import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase/client'
import { subscribeToAllTransactions } from '../../services/realtime/realtimeService'
import { formatRupiah, formatDateTime, formatTransactionStatus, generateIdempotencyKey } from '../../utils/format'
import { Card, Button, Badge, Modal, SkeletonTable, ResponsiveTable } from '../../components/ui'

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  // Correction Modal
  const [showCorrectionModal, setShowCorrectionModal] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [correctionType, setCorrectionType] = useState('DEBIT') // DEBIT (kurangi saldo) atau CREDIT (tambah saldo)
  const [correctionAmount, setCorrectionAmount] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')
  const [processing, setProcessing] = useState(false)

  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const loadData = async () => {
    setLoading(true)

    // 1. Fetch transactions with accounts join (without direct profiles join to avoid PGRST200)
    const [txRes, accRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, accounts:account_id(account_number)')
        .order('created_at', { ascending: false })
        .limit(60),
      supabase
        .from('accounts')
        .select('*, profiles:user_id(full_name)')
        .eq('status', 'ACTIVE'),
    ])

    // Manual profile join for transactions
    if (txRes.data && txRes.data.length > 0) {
      const userIds = [...new Set(txRes.data.map((t) => t.user_id).filter(Boolean))]
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds)

      const profMap = new Map((profs || []).map((p) => [p.id, p]))
      const enriched = txRes.data.map((t) => ({
        ...t,
        profiles: profMap.get(t.user_id) || null,
      }))
      setTransactions(enriched)
    } else {
      setTransactions([])
    }

    if (accRes.data) setAccounts(accRes.data)

    setLoading(false)
  }

  useEffect(() => {
    loadData()
    const unsub = subscribeToAllTransactions(() => loadData())
    return () => unsub?.()
  }, [])

  // Execute Correction
  const handleExecuteCorrection = async (e) => {
    e.preventDefault()
    if (!selectedAccountId || Number(correctionAmount) <= 0 || !correctionReason.trim()) {
      setErrorMsg('Semua kolom wajib diisi termasuk alasan koreksi resmi.')
      return
    }

    setProcessing(true)
    setErrorMsg('')
    setMessage('')

    const acc = accounts.find((a) => a.id === selectedAccountId)
    if (!acc) {
      setErrorMsg('Rekening tidak valid.')
      setProcessing(false)
      return
    }

    const amt = Number(correctionAmount)
    let newBal = Number(acc.book_balance)
    if (correctionType === 'CREDIT') newBal += amt
    else {
      if (newBal < amt) {
        setErrorMsg('Saldo tidak mencukupi untuk koreksi pengurangan.')
        setProcessing(false)
        return
      }
      newBal -= amt
    }

    const txNum = 'CORR-' + Date.now().toString(36).toUpperCase()

    // 1. Insert Transaction
    const { data: tx, error: txErr } = await supabase
      .from('transactions')
      .insert({
        transaction_number: txNum,
        account_id: acc.id,
        user_id: acc.user_id,
        transaction_type: 'CORRECTION',
        amount: amt,
        status: 'COMPLETED',
        description: `Koreksi Admin: ${correctionReason.trim()}`,
        idempotency_key: generateIdempotencyKey(),
        source: 'ADMIN',
        physical_confirmed: true,
        confirmed_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (txErr) {
      setErrorMsg('Gagal membuat transaksi koreksi: ' + txErr.message)
      setProcessing(false)
      return
    }

    // 2. Update Balance
    await supabase.from('accounts').update({ book_balance: newBal }).eq('id', acc.id)

    // 3. Ledger Entry
    await supabase.from('ledger_entries').insert({
      transaction_id: tx.id,
      account_id: acc.id,
      entry_type: correctionType,
      amount: amt,
      balance_after: newBal,
      description: `KOREKSI RESMI ADMIN: ${correctionReason.trim()}`,
    })

    // 4. Audit Log
    await supabase.from('audit_logs').insert({
      action: 'ADMIN_CORRECTION',
      entity_type: 'accounts',
      entity_id: acc.id,
      old_data: { balance_before: acc.book_balance },
      new_data: { balance_after: newBal, correction_amount: amt, reason: correctionReason },
    })

    setProcessing(false)
    setMessage(`Koreksi transaksi berhasil dicatat! Saldo rekening ${acc.account_number} telah disesuaikan.`)
    setShowCorrectionModal(false)
    setCorrectionAmount('')
    setCorrectionReason('')
    loadData()
  }

  const columns = [
    {
      key: 'transaction_number',
      label: 'No. Transaksi',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontWeight: '800', color: 'var(--text-primary)' }}>
          {v}
        </span>
      ),
    },
    {
      key: 'profiles',
      label: 'Nasabah & Rekening',
      render: (v, row) => (
        <div>
          <b style={{ color: 'var(--text-primary)' }}>{v?.full_name || 'Nasabah'}</b>
          <span style={{ display: 'block', fontSize: '11px', color: '#d4a853', fontFamily: 'monospace' }}>
            {row.accounts?.account_number || '-'}
          </span>
        </div>
      ),
    },
    {
      key: 'transaction_type',
      label: 'Tipe',
      render: (v) => {
        const isDep = v === 'DEPOSIT'
        const isCorr = v === 'CORRECTION'
        const variant = isDep ? 'success' : isCorr ? 'warning' : 'danger'
        return <Badge variant={variant}>{v}</Badge>
      },
    },
    {
      key: 'amount',
      label: 'Nominal',
      render: (v, row) => (
        <span style={{
          fontWeight: '800',
          color: row.transaction_type === 'DEPOSIT' ? '#10b981' : row.transaction_type === 'CORRECTION' ? '#d4a853' : '#f87171',
        }}>
          {formatRupiah(v)}
        </span>
      ),
    },
    {
      key: 'source',
      label: 'Sumber',
      render: (v) => <Badge variant="neutral">{v || 'MEMBER'}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => {
        const variant = v === 'COMPLETED' ? 'success' : v === 'PENDING' ? 'warning' : 'neutral'
        return <Badge variant={variant}>{formatTransactionStatus(v)}</Badge>
      },
    },
    {
      key: 'created_at',
      label: 'Waktu',
      render: (v) => (
        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
          {formatDateTime(v)}
        </span>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              BUKU BESAR & TRANSAKSI
            </span>
            <Badge variant="neutral">{transactions.length} Mutasi Terakhir</Badge>
          </div>
          <h1 style={{ fontSize: 'clamp(20px, 3vw, 24px)', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
            Manajemen Transaksi & Jurnal
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
            Pemantauan transaksi realtime, verifikasi setoran, dan koreksi pembukuan resmi
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => {
            setShowCorrectionModal(true)
            setErrorMsg('')
          }}
        >
          ⚖️ Koreksi Saldo Resmi
        </Button>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#34d399',
          fontSize: '12.5px',
          fontWeight: '700',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>✅</span>
          <span>{message}</span>
        </div>
      )}

      {/* Transaction Stream Table */}
      <Card variant="glass" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '20px' }}>
            <SkeletonTable rows={6} columns={7} />
          </div>
        ) : (
          <ResponsiveTable
            columns={columns}
            data={transactions}
            keyField="id"
            emptyMessage="Belum ada transaksi mutasi tercatat."
          />
        )}
      </Card>

      {/* Modal Koreksi Saldo Resmi */}
      <Modal
        isOpen={showCorrectionModal}
        onClose={() => setShowCorrectionModal(false)}
        title="Formulir Koreksi Saldo Resmi"
        maxWidth="460px"
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', margin: '0 0 16px', lineHeight: '1.5' }}>
          Tindakan ini akan membuat transaksi tipe <b style={{ color: '#d4a853' }}>CORRECTION</b> dan catatan audit trail permanen yang terhubung ke pembukuan buku besar.
        </p>

        {errorMsg && (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: '12px',
            borderRadius: '8px',
            marginBottom: '14px',
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleExecuteCorrection} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Pilih Rekening Tujuan
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated, #161b22)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              <option value="">Pilih Rekening...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_number} · {a.profiles?.full_name || 'Member'} (Saldo: {formatRupiah(a.book_balance)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Aksi Koreksi
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setCorrectionType('CREDIT')}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '8px',
                  border: correctionType === 'CREDIT' ? '1px solid #10b981' : '1px solid var(--border)',
                  background: correctionType === 'CREDIT' ? 'rgba(16,185,129,0.18)' : 'rgba(240,246,252,0.03)',
                  color: correctionType === 'CREDIT' ? '#34d399' : 'var(--text-secondary)',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                + Tambah Saldo (Credit)
              </button>
              <button
                type="button"
                onClick={() => setCorrectionType('DEBIT')}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '8px',
                  border: correctionType === 'DEBIT' ? '1px solid #ef4444' : '1px solid var(--border)',
                  background: correctionType === 'DEBIT' ? 'rgba(239,68,68,0.18)' : 'rgba(240,246,252,0.03)',
                  color: correctionType === 'DEBIT' ? '#f87171' : 'var(--text-secondary)',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                - Kurangi Saldo (Debit)
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Nominal Penyesuaian (Rp)
            </label>
            <input
              type="number"
              placeholder="Contoh: 50000"
              value={correctionAmount}
              onChange={(e) => setCorrectionAmount(e.target.value)}
              min="1000"
              step="1000"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated, #161b22)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: '700',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Alasan Resmi Koreksi (Wajib Audit)
            </label>
            <textarea
              placeholder="Jelaskan alasan selisih fisik atau koreksi administratif..."
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              required
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated, #161b22)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
            <Button type="button" variant="outline" onClick={() => setShowCorrectionModal(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={processing} disabled={processing}>
              {processing ? 'Mengeksekusi...' : 'Eksekusi Koreksi ➔'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
