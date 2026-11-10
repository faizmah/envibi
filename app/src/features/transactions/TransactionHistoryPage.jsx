import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { supabase } from '../../services/supabase/client'
import { formatRupiah, formatDateTime, formatTransactionStatus } from '../../utils/format'

export default function TransactionHistoryPage() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterType, setFilterType] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    async function loadTransactions() {
      if (!user) return
      setLoading(true)

      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (filterType !== 'ALL') {
        query = query.eq('transaction_type', filterType)
      }
      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00`)
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59`)
      }

      const { data } = await query
      setTransactions(data || [])
      setLoading(false)
    }

    loadTransactions()
  }, [user, filterType, startDate, endDate])

  // Filter query client-side
  const filtered = transactions.filter((t) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      t.transaction_number?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q)
    )
  })

  // Export CSV
  const handleExportCSV = () => {
    if (filtered.length === 0) return
    const headers = ['No. Transaksi', 'Waktu', 'Jenis', 'Nominal (Rp)', 'Status', 'Catatan']
    const rows = filtered.map((t) => [
      t.transaction_number,
      new Date(t.created_at).toLocaleString('id-ID'),
      t.transaction_type,
      t.amount,
      t.status,
      `"${(t.description || '').replace(/"/g, '""')}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Transaksi_NVB_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '20px auto 60px', padding: '0 20px' }}>
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>Riwayat Mutasi & Transaksi</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: '12px' }}>
              Catatan lengkap setiap aliran tabungan setor dan tarik
            </p>
          </div>
          <button onClick={handleExportCSV} className="btn btn-secondary btn-sm" disabled={filtered.length === 0}>
            📥 Unduh Laporan CSV
          </button>
        </div>

        {/* Filters */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '10px',
          marginBottom: '20px',
          background: 'rgba(255,255,255,0.02)',
          padding: '14px',
          borderRadius: '12px',
        }}>
          <div>
            <label className="form-label">Cari Nomor / Keterangan</label>
            <input
              type="text"
              className="form-field"
              placeholder="Cari transaksi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ margin: 0 }}
            />
          </div>

          <div>
            <label className="form-label">Jenis Transaksi</label>
            <select
              className="form-field"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ margin: 0 }}
            >
              <option value="ALL">Semua Jenis</option>
              <option value="DEPOSIT">Setoran (Masuk)</option>
              <option value="WITHDRAWAL">Penarikan (Keluar)</option>
            </select>
          </div>

          <div>
            <label className="form-label">Dari Tanggal</label>
            <input
              type="date"
              className="form-field"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ margin: 0 }}
            />
          </div>

          <div>
            <label className="form-label">Sampai Tanggal</label>
            <input
              type="date"
              className="form-field"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ margin: 0 }}
            />
          </div>
        </div>

        {/* Transactions Table */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--fg-muted)' }}>Memuat riwayat...</p>
          </div>
        ) : filtered.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--fg-muted)' }}>
                  <th style={{ padding: '10px 12px' }}>No. Transaksi</th>
                  <th style={{ padding: '10px 12px' }}>Waktu</th>
                  <th style={{ padding: '10px 12px' }}>Jenis</th>
                  <th style={{ padding: '10px 12px' }}>Nominal</th>
                  <th style={{ padding: '10px 12px' }}>Keterangan</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid rgba(220, 230, 240, 0.05)' }}>
                    <td style={{ padding: '12px', fontWeight: '700' }}>{tx.transaction_number}</td>
                    <td style={{ padding: '12px', color: 'var(--fg-muted)' }}>{formatDateTime(tx.created_at)}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '800',
                        background: tx.transaction_type === 'DEPOSIT' ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                        color: tx.transaction_type === 'DEPOSIT' ? '#65d69a' : '#ff8a80',
                      }}>
                        {tx.transaction_type === 'DEPOSIT' ? 'Setoran' : 'Penarikan'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: '800' }}>{formatRupiah(tx.amount)}</td>
                    <td style={{ padding: '12px', color: 'var(--fg-muted)' }}>{tx.description || '-'}</td>
                    <td style={{ padding: '12px' }}>
                      <span className={`status ${tx.status === 'COMPLETED' ? 'good' : 'wait'}`}>
                        {formatTransactionStatus(tx.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--fg-muted)' }}>
            Tidak ada transaksi yang cocok dengan kriteria pencarian.
          </div>
        )}
      </div>
    </div>
  )
}

