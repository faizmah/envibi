import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { supabase } from '../../services/supabase/client'
import { formatRupiah, formatDateTime, formatTransactionStatus } from '../../utils/format'
import { Card, Button, Badge, SkeletonTable, ResponsiveTable } from '../../components/ui'

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

  const columns = [
    {
      key: 'transaction_number',
      label: 'No. Transaksi',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontWeight: '700', color: 'var(--text-primary)' }}>
          {v}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Waktu',
      render: (v) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
          {formatDateTime(v)}
        </span>
      ),
    },
    {
      key: 'transaction_type',
      label: 'Jenis',
      render: (v) => (
        <Badge variant={v === 'DEPOSIT' ? 'success' : 'danger'}>
          {v === 'DEPOSIT' ? '📥 Setoran' : '📤 Penarikan'}
        </Badge>
      ),
    },
    {
      key: 'amount',
      label: 'Nominal',
      render: (v, row) => (
        <span style={{
          fontWeight: '800',
          color: row.transaction_type === 'DEPOSIT' ? '#10b981' : '#f87171',
        }}>
          {row.transaction_type === 'DEPOSIT' ? '+' : '-'}{formatRupiah(v)}
        </span>
      ),
    },
    {
      key: 'description',
      label: 'Keterangan',
      render: (v) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
          {v || 'Transaksi Mandiri'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <Badge variant={v === 'COMPLETED' ? 'success' : v === 'PENDING' ? 'warning' : 'neutral'}>
          {formatTransactionStatus(v)}
        </Badge>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: '1100px', margin: '10px auto 40px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px',
      }}>
        <div>
          <h1 style={{ fontSize: 'clamp(20px, 3vw, 24px)', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
            Riwayat Mutasi & Transaksi
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
            Catatan lengkap seluruh aliran dana masuk (setor) dan keluar (tarik) pada rekening tabungan Anda
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={filtered.length === 0}
        >
          📥 Unduh Laporan (.CSV)
        </Button>
      </div>

      {/* Filter Section */}
      <Card variant="glass" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Cari No. / Keterangan
            </label>
            <input
              type="text"
              placeholder="Ketik untuk mencari..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated, #161b22)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Jenis Transaksi
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated, #161b22)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                outline: 'none',
                boxSizing: 'border-box',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">Semua Jenis</option>
              <option value="DEPOSIT">Setoran (Masuk)</option>
              <option value="WITHDRAWAL">Penarikan (Keluar)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Dari Tanggal
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated, #161b22)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Sampai Tanggal
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated, #161b22)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {(searchQuery || filterType !== 'ALL' || startDate || endDate) && (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              Menampilkan {filtered.length} transaksi terfilter
            </span>
            <button
              onClick={() => {
                setSearchQuery('')
                setFilterType('ALL')
                setStartDate('')
                setEndDate('')
              }}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#d4a853',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              Reset Filter ✕
            </button>
          </div>
        )}
      </Card>

      {/* Transactions Table */}
      <Card variant="glass" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '20px' }}>
            <SkeletonTable rows={5} columns={6} />
          </div>
        ) : (
          <ResponsiveTable
            columns={columns}
            data={filtered}
            keyField="id"
            emptyMessage="Belum ada transaksi yang sesuai dengan filter pencarian Anda."
          />
        )}
      </Card>
    </div>
  )
}
