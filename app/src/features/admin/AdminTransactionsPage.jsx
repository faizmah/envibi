import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase/client'
import { subscribeToAllTransactions } from '../../services/realtime/realtimeService'
import { formatRupiah, formatDateTime, formatTransactionStatus, generateIdempotencyKey } from '../../utils/format'

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

    const [txRes, accRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, profiles:user_id(full_name, email), accounts:account_id(account_number)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('accounts')
        .select('*, profiles:user_id(full_name)')
        .eq('status', 'ACTIVE'),
    ])

    if (txRes.data) setTransactions(txRes.data)
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>Manajemen Transaksi & Jurnal</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: '12px' }}>
            Pemantauan transaksi realtime, verifikasi setoran, dan koreksi pembukuan resmi
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setShowCorrectionModal(true)
            setErrorMsg('')
          }}
        >
          ⚖️ Buat Koreksi Saldo Resmi
        </button>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(46, 204, 113, 0.18)', color: '#65d69a', fontSize: '12px', fontWeight: '700', marginBottom: '20px' }}>
          ✅ {message}
        </div>
      )}

      {/* Transaction Realtime Stream Table */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '14px' }}>Aliran Transaksi Realtime</h3>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--fg-muted)' }}>Memuat transaksi...</p>
          </div>
        ) : transactions.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--fg-muted)' }}>
                  <th style={{ padding: '8px 12px' }}>No. Transaksi</th>
                  <th style={{ padding: '8px 12px' }}>Member & Rekening</th>
                  <th style={{ padding: '8px 12px' }}>Tipe</th>
                  <th style={{ padding: '8px 12px' }}>Nominal</th>
                  <th style={{ padding: '8px 12px' }}>Sumber</th>
                  <th style={{ padding: '8px 12px' }}>Status</th>
                  <th style={{ padding: '8px 12px' }}>Waktu</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid rgba(220, 230, 240, 0.05)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '800' }}>{t.transaction_number}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <b>{t.profiles?.full_name || 'Member'}</b>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--fg-muted)' }}>
                        {t.accounts?.account_number || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '800',
                        background: t.transaction_type === 'DEPOSIT' ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                        color: t.transaction_type === 'DEPOSIT' ? '#65d69a' : '#ff8a80',
                      }}>
                        {t.transaction_type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: '800' }}>{formatRupiah(t.amount)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className="status info">{t.source}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`status ${t.status === 'COMPLETED' ? 'good' : 'wait'}`}>
                        {formatTransactionStatus(t.status)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--fg-muted)' }}>{formatDateTime(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--fg-muted)', fontSize: '12px', textAlign: 'center', margin: '30px 0' }}>
            Belum ada transaksi tercatat.
          </p>
        )}
      </div>

      {/* Modal Koreksi Saldo Resmi */}
      {showCorrectionModal && (
        <div className="member-portal-overlay">
          <div className="card" style={{ maxWidth: '460px', width: '100%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Formulir Koreksi Saldo Resmi</h3>
            <p style={{ color: 'var(--fg-muted)', fontSize: '12px', margin: '0 0 16px' }}>
              Koreksi ini akan membuat catatan mutasi pembukuan dan jejak audit permanen. Alasan wajib dicatat.
            </p>

            {errorMsg && (
              <div style={{ padding: '8px 12px', background: 'rgba(231, 76, 60, 0.2)', color: '#ff8a80', fontSize: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleExecuteCorrection} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label">Pilih Rekening Tujuan</label>
                <select
                  className="form-field"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  required
                >
                  <option value="">Pilih Rekening...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_number} · {a.profiles?.full_name} ({formatRupiah(a.book_balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Jenis Penyesuaian Saldo</label>
                <select
                  className="form-field"
                  value={correctionType}
                  onChange={(e) => setCorrectionType(e.target.value)}
                >
                  <option value="CREDIT">Kredit (+) Tambah Saldo Pembukuan</option>
                  <option value="DEBIT">Debit (-) Kurangi Saldo Pembukuan</option>
                </select>
              </div>

              <div>
                <label className="form-label">Nominal Koreksi (Rp)</label>
                <input
                  type="number"
                  className="form-field"
                  placeholder="Contoh: 100000"
                  value={correctionAmount}
                  onChange={(e) => setCorrectionAmount(e.target.value)}
                  min="1"
                  step="1000"
                  required
                />
              </div>

              <div>
                <label className="form-label">Alasan Koreksi (Wajib Diisi Secara Resmi)</label>
                <textarea
                  className="form-field"
                  rows="3"
                  placeholder="Contoh: Penyesuaian selisih setoran member tanggal 10 Nov sesuai bukti transfer"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCorrectionModal(false)}
                >
                  Batal
                </button>
                <button type="submit" disabled={processing} className="btn btn-primary">
                  {processing ? 'Memproses...' : 'Simpan Koreksi & Mutasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

