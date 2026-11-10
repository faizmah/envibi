import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { supabase } from '../../services/supabase/client'
import { formatRupiah, formatDateTime } from '../../utils/format'

export default function ReportsPage() {
  const { user, profile } = useAuth()

  const [account, setAccount] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadReportData() {
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

        const { data: txs } = await supabase
          .from('transactions')
          .select('*')
          .eq('account_id', accs[0].id)
          .eq('status', 'COMPLETED')
          .order('created_at', { ascending: false })

        setTransactions(txs || [])
      }

      setLoading(false)
    }

    loadReportData()
  }, [user])

  // Calculation Metrics
  const deposits = transactions.filter((t) => t.transaction_type === 'DEPOSIT')
  const withdrawals = transactions.filter((t) => t.transaction_type === 'WITHDRAWAL')

  const totalDepositAmount = deposits.reduce((s, t) => s + Number(t.amount || 0), 0)
  const totalWithdrawalAmount = withdrawals.reduce((s, t) => s + Number(t.amount || 0), 0)
  const avgDeposit = deposits.length > 0 ? Math.round(totalDepositAmount / deposits.length) : 0

  // Export CSV Handler
  const handleExportCSV = () => {
    if (transactions.length === 0) return
    const headers = ['No. Transaksi', 'Tanggal', 'Tipe', 'Nominal', 'Keterangan']
    const rows = transactions.map((t) => [
      t.transaction_number,
      new Date(t.created_at).toLocaleString('id-ID'),
      t.transaction_type,
      t.amount,
      `"${(t.description || '').replace(/"/g, '""')}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Laporan_Keuangan_NVB_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Print Window (PDF export trigger)
  const handlePrintPDF = () => {
    window.print()
  }

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--fg-muted)' }}>Menyusun laporan keuangan...</p>
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
    <div style={{ maxWidth: '900px', margin: '20px auto 60px', padding: '0 20px' }}>
      {/* Report Header Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--accent2)', fontWeight: '800' }}>
              LAPORAN KEUANGAN PRIBADI
            </span>
            <h2 style={{ margin: '4px 0', fontSize: '22px', fontWeight: '800' }}>
              Ringkasan & Analisis Tabungan
            </h2>
            <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: '12px' }}>
              Nasabah: {profile?.full_name || user?.email} · No. Rekening: {account.account_number}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleExportCSV} className="btn btn-secondary btn-sm">
              📥 Ekspor CSV
            </button>
            <button onClick={handlePrintPDF} className="btn btn-primary btn-sm">
              🖨️ Cetak / Simpan PDF
            </button>
          </div>
        </div>

        {/* KPI Financial Overview */}
        <div className="kpi-grid" style={{ marginTop: '16px' }}>
          <div className="kpi-item" style={{ borderLeft: '4px solid var(--accent)' }}>
            <span className="kpi-label">Saldo Saat Ini</span>
            <b className="kpi-value" style={{ color: 'var(--accent2)' }}>{formatRupiah(account.book_balance)}</b>
          </div>
          <div className="kpi-item" style={{ borderLeft: '4px solid #2ecc71' }}>
            <span className="kpi-label">Total Setoran Akumulatif</span>
            <b className="kpi-value" style={{ color: '#65d69a' }}>{formatRupiah(totalDepositAmount)}</b>
            <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>{deposits.length} kali setor</small>
          </div>
          <div className="kpi-item" style={{ borderLeft: '4px solid #e74c3c' }}>
            <span className="kpi-label">Total Penarikan Akumulatif</span>
            <b className="kpi-value" style={{ color: '#ff8a80' }}>{formatRupiah(totalWithdrawalAmount)}</b>
            <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>{withdrawals.length} kali tarik</small>
          </div>
          <div className="kpi-item" style={{ borderLeft: '4px solid #3498db' }}>
            <span className="kpi-label">Rata-rata Nominal Setoran</span>
            <b className="kpi-value">{formatRupiah(avgDeposit)}</b>
            <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Per transaksi setoran</small>
          </div>
        </div>
      </div>

      {/* Visual Activity Bar Summary */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 className="card-title" style={{ marginBottom: '14px' }}>📊 Rasio Pemasukan vs Penarikan Tabungan</h3>
        {totalDepositAmount + totalWithdrawalAmount > 0 ? (
          <div>
            <div style={{ height: '14px', background: '#e74c3c', borderRadius: '7px', overflow: 'hidden', display: 'flex' }}>
              <div
                style={{
                  width: `${(totalDepositAmount / (totalDepositAmount + totalWithdrawalAmount)) * 100}%`,
                  background: '#2ecc71',
                  transition: 'width 0.4s',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '8px' }}>
              <span style={{ color: '#65d69a' }}>
                ● Setoran ({Math.round((totalDepositAmount / (totalDepositAmount + totalWithdrawalAmount)) * 100)}%)
              </span>
              <span style={{ color: '#ff8a80' }}>
                ● Penarikan ({Math.round((totalWithdrawalAmount / (totalDepositAmount + totalWithdrawalAmount)) * 100)}%)
              </span>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--fg-muted)', fontSize: '12px' }}>Belum ada data untuk kalkulasi rasio.</p>
        )}
      </div>

      {/* Detail Rekening Koran (Statement) */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '14px' }}>📑 Salinan Rekening Koran</h3>
        {transactions.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--fg-muted)' }}>
                  <th style={{ padding: '8px 12px' }}>No. Transaksi</th>
                  <th style={{ padding: '8px 12px' }}>Waktu</th>
                  <th style={{ padding: '8px 12px' }}>Jenis</th>
                  <th style={{ padding: '8px 12px' }}>Nominal</th>
                  <th style={{ padding: '8px 12px' }}>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid rgba(220, 230, 240, 0.05)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '700' }}>{t.transaction_number}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--fg-muted)' }}>{formatDateTime(t.created_at)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`status ${t.transaction_type === 'DEPOSIT' ? 'good' : 'bad'}`}>
                        {t.transaction_type === 'DEPOSIT' ? 'SETORAN' : 'PENARIKAN'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: '800' }}>{formatRupiah(t.amount)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--fg-muted)' }}>{t.description || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--fg-muted)', fontSize: '12px', textAlign: 'center', margin: '20px 0' }}>
            Belum ada riwayat transaksi yang terselesaikan.
          </p>
        )}
      </div>
    </div>
  )
}

