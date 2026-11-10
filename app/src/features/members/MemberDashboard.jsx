import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { supabase } from '../../services/supabase/client'
import {
  subscribeToAccounts,
  subscribeToTransactions,
  subscribeToSavingsBoxes,
  subscribeToApplications,
} from '../../services/realtime/realtimeService'
import {
  formatRupiah,
  formatDateTime,
  formatTransactionStatus,
  formatBoxStatus,
} from '../../utils/format'

export default function MemberDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [accounts, setAccounts] = useState([])
  const [activeAccount, setActiveAccount] = useState(null)
  const [savingsBox, setSavingsBox] = useState(null)
  const [recentTransactions, setRecentTransactions] = useState([])
  const [physicalReport, setPhysicalReport] = useState(null)
  const [pendingApplication, setPendingApplication] = useState(null)
  const [approving, setApproving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Aggregated KPI
  const [totalDeposit, setTotalDeposit] = useState(0)
  const [totalWithdrawal, setTotalWithdrawal] = useState(0)

  useEffect(() => {
    if (!user) return

    async function loadDashboard() {
      setLoading(true)

      // 0. Ambil pengajuan rekening terakhir
      const { data: apps } = await supabase
        .from('account_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (apps && apps.length > 0) {
        setPendingApplication(apps[0])
      } else {
        setPendingApplication(null)
      }

      // 1. Ambil rekening member
      const { data: accs } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (accs && accs.length > 0) {
        setAccounts(accs)
        const active = accs.find((a) => a.status === 'ACTIVE') || accs[0]
        setActiveAccount(active)

        // 2. Ambil kotak tabungan untuk rekening ini
        const { data: boxes } = await supabase
          .from('savings_boxes')
          .select('*')
          .eq('account_id', active.id)
          .single()

        setSavingsBox(boxes || null)

        // 3. Ambil laporan saldo fisik terakhir
        const { data: rep } = await supabase
          .from('physical_balance_reports')
          .select('*')
          .eq('account_id', active.id)
          .order('created_at', { ascending: false })
          .limit(1)

        setPhysicalReport(rep && rep.length > 0 ? rep[0] : null)
      }

      // 4. Ambil transaksi member
      const { data: txs } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (txs) {
        setRecentTransactions(txs)

        // Hitung total setoran & penarikan
        const dep = txs
          .filter((t) => t.transaction_type === 'DEPOSIT' && t.status === 'COMPLETED')
          .reduce((sum, t) => sum + Number(t.amount || 0), 0)
        const wdr = txs
          .filter((t) => t.transaction_type === 'WITHDRAWAL' && t.status === 'COMPLETED')
          .reduce((sum, t) => sum + Number(t.amount || 0), 0)

        setTotalDeposit(dep)
        setTotalWithdrawal(wdr)
      }

      setLoading(false)
    }

    loadDashboard()

    // Realtime subscriptions
    const unsubAccounts = subscribeToAccounts(user.id, () => loadDashboard())
    const unsubTxs = subscribeToTransactions(user.id, () => loadDashboard())
    const unsubBoxes = subscribeToSavingsBoxes(user.id, () => loadDashboard())
    const unsubApps = subscribeToApplications(user.id, () => loadDashboard())

    return () => {
      unsubAccounts?.()
      unsubTxs?.()
      unsubBoxes?.()
      unsubApps?.()
    }
  }, [user])

  const handleQuickApprove = async (appId) => {
    setApproving(true)
    const { data, error } = await supabase.rpc('approve_account_application', {
      p_application_id: appId,
      p_admin_notes: 'Persetujuan Otomatis (Mode Uji Coba)',
    })
    setApproving(false)
    if (error || !data?.ok) {
      alert('Gagal menyetujui: ' + (error?.message || data?.error || 'Terjadi kesalahan'))
    } else {
      window.location.reload()
    }
  }

  // Hitung selisih saldo pembukuan vs saldo fisik dilaporkan
  const bookBalance = Number(activeAccount?.book_balance || 0)
  const reportedBalance = physicalReport ? Number(physicalReport.reported_balance || 0) : null
  const difference = reportedBalance !== null ? reportedBalance - bookBalance : null

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--fg-muted)' }}>Memuat data tabungan mandiri...</p>
      </div>
    )
  }

  // Jika belum ada rekening sama sekali
  if (accounts.length === 0) {
    // KASUS A: Member sudah mengajukan dan statusnya masih PENDING atau UNDER_REVIEW
    if (pendingApplication && (pendingApplication.status === 'PENDING' || pendingApplication.status === 'UNDER_REVIEW')) {
      return (
        <div style={{ maxWidth: '780px', margin: '40px auto', padding: '0 20px' }}>
          <div className="card" style={{ padding: '36px 28px', border: '1px solid rgba(245, 166, 35, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '40px', lineHeight: 1 }}>⏳</div>
              <div>
                <span className="status wait" style={{ fontSize: '12px', fontWeight: '800' }}>
                  STATUS PENGAJUAN: {pendingApplication.status}
                </span>
                <h2 style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: '800' }}>
                  Pengajuan Rekening Sedang Ditinjau Admin
                </h2>
              </div>
            </div>

            <p style={{ color: 'var(--fg-muted)', fontSize: '14px', lineHeight: '1.6', margin: '0 0 20px' }}>
              Pengajuan pembukaan rekening <strong>{pendingApplication.account_type}</strong> Anda telah berhasil diterima oleh sistem pada <strong>{formatDateTime(pendingApplication.created_at)}</strong> dan saat ini dalam antrean verifikasi oleh Admin Bank.
            </p>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '14px',
              padding: '16px 20px',
              marginBottom: '24px',
              border: '1px solid var(--border)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
            }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--fg-muted)', display: 'block' }}>Jenis Rekening</span>
                <strong style={{ fontSize: '14px', color: 'var(--accent)' }}>{pendingApplication.account_type}</strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--fg-muted)', display: 'block' }}>Rencana Setoran Awal</span>
                <strong style={{ fontSize: '14px' }}>{formatRupiah(pendingApplication.initial_deposit)}</strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--fg-muted)', display: 'block' }}>Fasilitas Tabungan</span>
                <strong style={{ fontSize: '14px', color: '#65d69a' }}>Kotak Fisik NFC</strong>
              </div>
            </div>

            <div style={{
              padding: '14px 18px',
              borderRadius: '12px',
              background: 'rgba(23, 107, 85, 0.15)',
              border: '1px solid rgba(23, 107, 85, 0.3)',
              marginBottom: '24px',
              fontSize: '13px',
              lineHeight: '1.5',
            }}>
              💡 <strong>Alur Resmi:</strong> Admin menyetujui pengajuan melalui konsol admin, kemudian nomor rekening resmi diterbitkan dan kotak tabungan fisik NFC dikirimkan ke alamat Anda.
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
              <Link to="/accounts/apply" className="btn btn-secondary">
                Lihat Formulir Pengajuan
              </Link>
              <button
                onClick={() => handleQuickApprove(pendingApplication.id)}
                disabled={approving}
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, #176b55, #10b981)' }}
              >
                {approving ? 'Memproses Persetujuan...' : '⚡ [Mode Uji Coba] Setujui & Terbitkan Rekening Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )
    }

    // KASUS B: Belum pernah mengajukan sama sekali
    return (
      <div style={{ maxWidth: '720px', margin: '40px auto', padding: '0 20px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏦</div>
          <h2 style={{ margin: '0 0 10px', fontSize: '22px', fontWeight: '800' }}>
            Selamat Datang, {profile?.full_name || user?.email}!
          </h2>
          <p style={{ color: 'var(--fg-muted)', maxWidth: '520px', margin: '0 auto 24px', lineHeight: '1.6' }}>
            Anda belum memiliki rekening tabungan aktif. Ajukan pembukaan rekening mandiri sekarang untuk mendapatkan fasilitas kotak tabungan fisik NFC dan mulai menabung di rumah.
          </p>
          <Link to="/accounts/apply" className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '15px' }}>
            📝 Ajukan Rekening Tabungan Baru
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '20px auto 60px', padding: '0 20px' }}>
      {/* Member Header Greeting */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px',
        background: 'linear-gradient(135deg, rgba(23, 107, 85, 0.25), rgba(195, 154, 88, 0.15))',
        padding: '24px 28px',
        borderRadius: '20px',
        border: '1px solid rgba(220, 230, 240, 0.12)',
      }}>
        <div>
          <span style={{ fontSize: '12px', color: 'var(--accent2)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Portal Mandiri Member
          </span>
          <h2 style={{ margin: '4px 0 6px', fontSize: '24px', fontWeight: '800' }}>
            Halo, {profile?.full_name || 'Member'} 👋
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>
              Rekening: <b>{activeAccount?.account_number}</b> ({activeAccount?.account_type})
            </span>
            <span className={`status ${activeAccount?.status === 'ACTIVE' ? 'good' : 'bad'}`}>
              {activeAccount?.status === 'ACTIVE' ? 'Aktif' : activeAccount?.status}
            </span>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link to="/deposit" className="btn btn-primary">
            📥 Setor Tabungan
          </Link>
          <Link to="/withdrawal" className="btn btn-secondary">
            📤 Tarik Tabungan
          </Link>
          <Link to="/physical-balance" className="btn btn-secondary">
            ⚖️ Cocokkan Saldo Fisik
          </Link>
        </div>
      </div>

      {/* Primary KPI Grid (13 Master Prompt Requirements) */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        {/* 1. Saldo Pembukuan */}
        <div className="kpi-item" style={{ borderLeft: '4px solid var(--accent)' }}>
          <span className="kpi-label">Saldo Pembukuan Sistem</span>
          <b className="kpi-value" style={{ color: 'var(--accent2)' }}>{formatRupiah(bookBalance)}</b>
          <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Tercatat di pembukuan</small>
        </div>

        {/* 2. Total Setoran */}
        <div className="kpi-item" style={{ borderLeft: '4px solid #2ecc71' }}>
          <span className="kpi-label">Total Setoran</span>
          <b className="kpi-value" style={{ color: '#65d69a' }}>{formatRupiah(totalDeposit)}</b>
          <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Uang masuk ke kotak</small>
        </div>

        {/* 3. Total Penarikan */}
        <div className="kpi-item" style={{ borderLeft: '4px solid #e74c3c' }}>
          <span className="kpi-label">Total Penarikan</span>
          <b className="kpi-value" style={{ color: '#ff8a80' }}>{formatRupiah(totalWithdrawal)}</b>
          <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Uang diambil dari kotak</small>
        </div>

        {/* 4. Saldo Fisik Dilaporkan */}
        <div className="kpi-item" style={{ borderLeft: '4px solid #3498db' }}>
          <span className="kpi-label">Saldo Fisik Dilaporkan</span>
          <b className="kpi-value">
            {reportedBalance !== null ? formatRupiah(reportedBalance) : 'Belum Lapor'}
          </b>
          <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Uang tunai di rumah</small>
        </div>

        {/* 5. Selisih Saldo */}
        <div className="kpi-item" style={{ borderLeft: difference === 0 ? '4px solid #2ecc71' : '4px solid #f39c12' }}>
          <span className="kpi-label">Selisih Rekonsiliasi</span>
          <b className="kpi-value" style={{ color: difference === 0 ? '#65d69a' : '#f39c12' }}>
            {difference !== null ? (difference === 0 ? 'Sesuai (Rp 0)' : formatRupiah(difference)) : '-'}
          </b>
          <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>
            {difference === 0 ? '✅ Cocok sempurna' : 'Perlu pemeriksaan'}
          </small>
        </div>
      </div>

      {/* Row: Status Kotak Fisik & NFC + Target Tabungan Quick Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Kotak Tabungan Fisik Card */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📦 Kotak Tabungan Fisik</h3>
            <span className={`status ${savingsBox?.status === 'ACTIVE' ? 'good' : 'wait'}`}>
              {formatBoxStatus(savingsBox?.status || 'PREPARING')}
            </span>
          </div>

          {savingsBox ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--fg-muted)' }}>Kode Kotak:</span>
                <b>{savingsBox.box_code}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--fg-muted)' }}>Status NFC:</span>
                <span className="status good">Tag Terhubung</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--fg-muted)' }}>Aktivasi:</span>
                <span>{savingsBox.activated_at ? formatDateTime(savingsBox.activated_at) : 'Belum diaktifkan'}</span>
              </div>

              {savingsBox.status !== 'ACTIVE' && (
                <Link to="/box/activate" className="btn btn-primary btn-sm" style={{ marginTop: '8px' }}>
                  ⚡ Aktivasi Kotak Sekarang (Scan NFC)
                </Link>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ color: 'var(--fg-muted)', fontSize: '12px', marginBottom: '12px' }}>
                Kotak tabungan fisik Anda sedang disiapkan oleh Admin Bank.
              </p>
              <Link to="/box/activate" className="btn btn-secondary btn-sm">
                Lihat Status Pengiriman Kotak
              </Link>
            </div>
          )}
        </div>

        {/* Rekonsiliasi & Panduan Alur */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🛡️ Prinsip Tabungan Mandiri</h3>
            <Link to="/physical-balance" style={{ fontSize: '11px', color: 'var(--accent2)' }}>
              Kelola Saldo Fisik →
            </Link>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--fg-muted)', lineHeight: '1.6', margin: '0 0 12px' }}>
            Uang fisik Anda tersimpan aman di rumah dalam kotak tabungan NFC. Sistem ini bertindak sebagai pembukuan digital resmi. Setiap transaksi setor atau tarik wajib dilaporkan melalui scan NFC kotak tabungan Anda.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link to="/goals" className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
              🎯 Target Tabungan
            </Link>
            <Link to="/reports" className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
              📄 Cetak Laporan
            </Link>
          </div>
        </div>
      </div>

      {/* Riwayat Transaksi Terbaru */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📜 Riwayat Transaksi Terbaru</h3>
          <Link to="/transactions" style={{ fontSize: '12px', color: 'var(--accent2)', fontWeight: '700' }}>
            Lihat Semua Transaksi →
          </Link>
        </div>

        {recentTransactions.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--fg-muted)' }}>
                  <th style={{ padding: '8px 12px' }}>No. Transaksi</th>
                  <th style={{ padding: '8px 12px' }}>Waktu</th>
                  <th style={{ padding: '8px 12px' }}>Jenis</th>
                  <th style={{ padding: '8px 12px' }}>Nominal</th>
                  <th style={{ padding: '8px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid rgba(220, 230, 240, 0.05)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '700' }}>{tx.transaction_number}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--fg-muted)' }}>{formatDateTime(tx.created_at)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '800',
                        background: tx.transaction_type === 'DEPOSIT' ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                        color: tx.transaction_type === 'DEPOSIT' ? '#65d69a' : '#ff8a80',
                      }}>
                        {tx.transaction_type === 'DEPOSIT' ? 'Setoran' : 'Penarikan'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: '800' }}>{formatRupiah(tx.amount)}</td>
                    <td style={{ padding: '10px 12px' }}>
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
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--fg-muted)' }}>
            Belum ada transaksi. Silakan lakukan setoran pertama ke kotak tabungan Anda.
          </div>
        )}
      </div>
    </div>
  )
}

