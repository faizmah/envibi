import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { supabase } from '../../services/supabase/client'
import { formatRupiah, formatDateTime, formatBoxStatus } from '../../utils/format'

export default function AccountDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()

  const [account, setAccount] = useState(null)
  const [savingsBox, setSavingsBox] = useState(null)
  const [ledgerEntries, setLedgerEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDetail() {
      if (!id || !user) return
      setLoading(true)

      // Ambil rekening
      const { data: acc } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single()

      if (acc) {
        setAccount(acc)

        // Ambil kotak
        const { data: box } = await supabase
          .from('savings_boxes')
          .select('*')
          .eq('account_id', acc.id)
          .single()
        setSavingsBox(box || null)

        // Ambil mutasi buku besar (ledger)
        const { data: ledger } = await supabase
          .from('ledger_entries')
          .select('*')
          .eq('account_id', acc.id)
          .order('created_at', { ascending: false })

        setLedgerEntries(ledger || [])
      }

      setLoading(false)
    }

    loadDetail()
  }, [id, user])

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--fg-muted)' }}>Memuat rincian rekening...</p>
      </div>
    )
  }

  if (!account) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <h3>Rekening tidak ditemukan</h3>
        <Link to="/dashboard" className="btn btn-secondary">← Kembali ke Dashboard</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px', margin: '20px auto 60px', padding: '0 20px' }}>
      {/* Top Header */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div>
            <span style={{ fontSize: '11px', color: 'var(--accent2)', fontWeight: '800' }}>
              DETAIL REKENING TABUNGAN
            </span>
            <h2 style={{ margin: '4px 0', fontSize: '24px', fontWeight: '800' }}>
              {account.account_number}
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>
              Jenis: {account.account_type} · Mata Uang: {account.currency}
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="status good">{account.status}</span>
            <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--accent2)', marginTop: '6px' }}>
              {formatRupiah(account.book_balance)}
            </div>
            <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Saldo Pembukuan Resmi</small>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          <Link to="/deposit" className="btn btn-primary btn-sm">📥 Setor ke Kotak</Link>
          <Link to="/withdrawal" className="btn btn-secondary btn-sm">📤 Tarik dari Kotak</Link>
          <Link to="/physical-balance" className="btn btn-secondary btn-sm">⚖️ Rekonsiliasi Saldo</Link>
        </div>
      </div>

      {/* Kotak Tabungan Fisik Link */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 className="card-title" style={{ marginBottom: '14px' }}>📦 Kotak Tabungan Fisik Tertaut</h3>
        {savingsBox ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '12px' }}>
            <div>
              <span style={{ color: 'var(--fg-muted)', display: 'block' }}>Kode Kotak</span>
              <b>{savingsBox.box_code}</b>
            </div>
            <div>
              <span style={{ color: 'var(--fg-muted)', display: 'block' }}>Status Kotak</span>
              <span className="status good">{formatBoxStatus(savingsBox.status)}</span>
            </div>
            <div>
              <span style={{ color: 'var(--fg-muted)', display: 'block' }}>Tanggal Aktivasi</span>
              <span>{savingsBox.activated_at ? formatDateTime(savingsBox.activated_at) : 'Belum diaktifkan'}</span>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--fg-muted)', fontSize: '12px', margin: 0 }}>
            Belum ada kotak tabungan fisik yang ditautkan ke rekening ini.
          </p>
        )}
      </div>

      {/* Mutasi Buku Besar (Double-Entry Ledger) */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '14px' }}>📑 Buku Besar Mutasi Rekening (Ledger)</h3>
        {ledgerEntries.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--fg-muted)' }}>
                  <th style={{ padding: '8px 12px' }}>Waktu</th>
                  <th style={{ padding: '8px 12px' }}>Tipe</th>
                  <th style={{ padding: '8px 12px' }}>Keterangan</th>
                  <th style={{ padding: '8px 12px' }}>Nominal</th>
                  <th style={{ padding: '8px 12px' }}>Saldo Setelah</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid rgba(220, 230, 240, 0.05)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--fg-muted)' }}>{formatDateTime(l.created_at)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`status ${l.entry_type === 'CREDIT' ? 'good' : 'bad'}`}>
                        {l.entry_type === 'CREDIT' ? 'KREDIT (+)' : 'DEBIT (-)'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{l.description || '-'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: '800' }}>{formatRupiah(l.amount)}</td>
                    <td style={{ padding: '10px 12px', fontWeight: '700', color: 'var(--accent2)' }}>
                      {formatRupiah(l.balance_after)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--fg-muted)', fontSize: '12px', textAlign: 'center', margin: '20px 0' }}>
            Belum ada mutasi pembukuan pada rekening ini.
          </p>
        )}
      </div>
    </div>
  )
}

