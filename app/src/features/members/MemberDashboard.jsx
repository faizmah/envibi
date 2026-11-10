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
import { Card, Button, Badge, Skeleton, SkeletonGrid, SkeletonTable, ResponsiveTable } from '../../components/ui'

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
      <div style={{ maxWidth: '1100px', margin: '20px auto 60px', padding: '0 20px' }}>
        <div style={{ marginBottom: '24px' }}>
          <Skeleton height="90px" borderRadius="16px" />
        </div>
        <div style={{ marginBottom: '24px' }}>
          <SkeletonGrid count={4} height="110px" />
        </div>
        <SkeletonTable rows={5} />
      </div>
    )
  }

  // Jika belum ada rekening sama sekali
  if (accounts.length === 0) {
    // KASUS A: Member sudah mengajukan dan statusnya masih PENDING atau UNDER_REVIEW
    if (pendingApplication && (pendingApplication.status === 'PENDING' || pendingApplication.status === 'UNDER_REVIEW')) {
      return (
        <div style={{ maxWidth: '780px', margin: '40px auto 80px', padding: '0 20px' }}>
          <Card variant="elevated" style={{ padding: '36px 28px', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '42px', lineHeight: 1 }}>⏳</div>
              <div>
                <Badge variant="warning" dot style={{ marginBottom: '6px' }}>
                  STATUS PENGAJUAN: {pendingApplication.status}
                </Badge>
                <h2 style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: '800' }}>
                  Pengajuan Rekening Sedang Ditinjau Admin
                </h2>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: '1.6', margin: '0 0 20px' }}>
              Pengajuan pembukaan rekening <strong>{pendingApplication.account_type}</strong> Anda telah berhasil diterima oleh sistem pada <strong>{formatDateTime(pendingApplication.created_at)}</strong> dan saat ini dalam antrean verifikasi resmi oleh Admin Bank.
            </p>

            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '14px',
              padding: '16px 20px',
              marginBottom: '24px',
              border: '1px solid var(--border)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '14px',
            }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Jenis Rekening</span>
                <strong style={{ fontSize: '14px', color: 'var(--accent)' }}>{pendingApplication.account_type}</strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Rencana Setoran Awal</span>
                <strong style={{ fontSize: '14px' }}>{formatRupiah(pendingApplication.initial_deposit)}</strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Fasilitas Tabungan</span>
                <strong style={{ fontSize: '14px', color: '#10b981' }}>Kotak Fisik Smart NFC</strong>
              </div>
            </div>

            <div style={{
              padding: '14px 18px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              marginBottom: '24px',
              fontSize: '12.5px',
              lineHeight: '1.5',
              color: '#d1fae5',
            }}>
              💡 <strong>Alur Resmi:</strong> Admin menyetujui pengajuan melalui konsol admin, kemudian nomor rekening resmi diterbitkan dan kotak tabungan fisik ber-NFC dikirimkan ke alamat Anda.
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
              <Link to="/accounts/apply">
                <Button variant="secondary">Lihat Formulir Pengajuan</Button>
              </Link>
              <Button
                variant="primary"
                onClick={() => handleQuickApprove(pendingApplication.id)}
                loading={approving}
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                ⚡ [Mode Uji Coba] Setujui & Terbitkan Rekening Sekarang
              </Button>
            </div>
          </Card>
        </div>
      )
    }

    // KASUS B: Belum pernah mengajukan sama sekali
    return (
      <div style={{ maxWidth: '720px', margin: '40px auto 80px', padding: '0 20px' }}>
        <Card variant="elevated" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '52px', marginBottom: '16px' }}>🏦</div>
          <h2 style={{ margin: '0 0 10px', fontSize: '24px', fontWeight: '800' }}>
            Selamat Datang, {profile?.full_name || user?.email}!
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto 24px', lineHeight: '1.6', fontSize: '14px' }}>
            Anda belum memiliki rekening tabungan aktif. Ajukan pembukaan rekening mandiri sekarang untuk mendapatkan fasilitas kotak tabungan fisik NFC dan mulai menabung di rumah secara realtime.
          </p>
          <Link to="/accounts/apply">
            <Button variant="primary" size="lg" icon="📝">
              Ajukan Rekening Tabungan Baru
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  // Kolom konfigurasi untuk ResponsiveTable
  const transactionColumns = [
    {
      key: 'transaction_number',
      label: 'No. Transaksi',
      render: (val) => <span style={{ fontWeight: '700', fontFamily: 'monospace' }}>{val}</span>,
    },
    {
      key: 'created_at',
      label: 'Waktu',
      render: (val) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{formatDateTime(val)}</span>,
    },
    {
      key: 'transaction_type',
      label: 'Jenis',
      render: (val) => (
        <Badge variant={val === 'DEPOSIT' ? 'success' : 'danger'}>
          {val === 'DEPOSIT' ? '📥 Setoran' : '📤 Penarikan'}
        </Badge>
      ),
    },
    {
      key: 'amount',
      label: 'Nominal',
      render: (val, row) => (
        <b style={{ color: row.transaction_type === 'DEPOSIT' ? 'var(--success)' : 'var(--text-primary)', fontSize: '13px' }}>
          {row.transaction_type === 'DEPOSIT' ? '+' : '-'}{formatRupiah(val)}
        </b>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => (
        <Badge variant={val === 'COMPLETED' ? 'success' : 'warning'} dot>
          {formatTransactionStatus(val)}
        </Badge>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: '1100px', margin: '16px auto 60px', padding: '0 clamp(12px, 3vw, 24px)' }}>
      {/* ─── Hero Member Greeting Card ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '18px',
          marginBottom: '24px',
          background: 'linear-gradient(135deg, rgba(212, 168, 83, 0.12), rgba(16, 185, 129, 0.08))',
          padding: 'clamp(20px, 3vw, 28px)',
          borderRadius: '20px',
          border: '1px solid rgba(212, 168, 83, 0.25)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Portal Tabungan Mandiri
            </span>
            <Badge variant="success" dot>Aktif Online</Badge>
          </div>
          <h2 style={{ margin: '4px 0 6px', fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: '900', color: 'var(--text-primary)' }}>
            Halo, {profile?.full_name || 'Member'} 👋
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              No. Rekening: <b style={{ color: 'var(--text-primary)' }}>{activeAccount?.account_number}</b> ({activeAccount?.account_type})
            </span>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/deposit">
            <Button variant="primary" icon="📥">Setor Tabungan</Button>
          </Link>
          <Link to="/withdrawal">
            <Button variant="secondary" icon="📤">Tarik Tabungan</Button>
          </Link>
          <Link to="/accounts/apply">
            <Button variant="outline" icon="📝" style={{ borderColor: 'rgba(212, 168, 83, 0.4)', color: '#d4a853' }}>
              Pesan Tabungan Baru
            </Button>
          </Link>
          <Link to="/physical-balance">
            <Button variant="ghost" icon="⚖️">Cocokkan Saldo</Button>
          </Link>
        </div>
      </div>

      {/* ─── Primary KPI Stat Grid (Standard 2026) ─── */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        {/* 1. Saldo Pembukuan */}
        <div className="kpi-item" style={{ borderLeft: '4px solid var(--accent)' }}>
          <span className="kpi-label">Saldo Pembukuan Sistem</span>
          <b className="kpi-value" style={{ color: 'var(--accent2)', fontSize: 'clamp(18px, 2.5vw, 22px)' }}>
            {formatRupiah(bookBalance)}
          </b>
          <small style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Tercatat di sistem bank</small>
        </div>

        {/* 2. Total Setoran */}
        <div className="kpi-item" style={{ borderLeft: '4px solid var(--success)' }}>
          <span className="kpi-label">Total Setoran</span>
          <b className="kpi-value" style={{ color: 'var(--success)', fontSize: 'clamp(18px, 2.5vw, 22px)' }}>
            {formatRupiah(totalDeposit)}
          </b>
          <small style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Kas masuk ke kotak tabungan</small>
        </div>

        {/* 3. Total Penarikan */}
        <div className="kpi-item" style={{ borderLeft: '4px solid var(--danger)' }}>
          <span className="kpi-label">Total Penarikan</span>
          <b className="kpi-value" style={{ color: '#ff8a80', fontSize: 'clamp(18px, 2.5vw, 22px)' }}>
            {formatRupiah(totalWithdrawal)}
          </b>
          <small style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Uang diambil dari kotak</small>
        </div>

        {/* 4. Saldo Fisik Dilaporkan */}
        <div className="kpi-item" style={{ borderLeft: '4px solid #3b82f6' }}>
          <span className="kpi-label">Saldo Fisik Dilaporkan</span>
          <b className="kpi-value" style={{ fontSize: 'clamp(18px, 2.5vw, 22px)' }}>
            {reportedBalance !== null ? formatRupiah(reportedBalance) : 'Belum Lapor'}
          </b>
          <small style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Uang tunai fisik di rumah</small>
        </div>

        {/* 5. Selisih Rekonsiliasi */}
        <div className="kpi-item" style={{ borderLeft: difference === 0 ? '4px solid var(--success)' : '4px solid var(--warning)' }}>
          <span className="kpi-label">Selisih Rekonsiliasi</span>
          <b className="kpi-value" style={{ color: difference === 0 ? 'var(--success)' : 'var(--warning)', fontSize: 'clamp(18px, 2.5vw, 22px)' }}>
            {difference !== null ? (difference === 0 ? 'Sesuai (Rp 0)' : formatRupiah(difference)) : '-'}
          </b>
          <small style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
            {difference === 0 ? '✅ Cocok sempurna' : 'Perlu pemeriksaan'}
          </small>
        </div>
      </div>

      {/* ─── Row: Status Kotak Fisik NFC & Panduan ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Kotak Tabungan Fisik Card */}
        <Card
          variant="glass"
          title="📦 Fasilitas Kotak Tabungan Fisik"
          action={
            <Badge variant={savingsBox?.status === 'ACTIVE' ? 'success' : 'warning'} dot>
              {formatBoxStatus(savingsBox?.status || 'PREPARING')}
            </Badge>
          }
        >
          {savingsBox ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Kode Identitas Kotak:</span>
                <b style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{savingsBox.box_code}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Status Tag NFC:</span>
                <Badge variant="success">✅ Tag NFC Terhubung</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Waktu Aktivasi:</span>
                <span>{savingsBox.activated_at ? formatDateTime(savingsBox.activated_at) : 'Belum diaktifkan'}</span>
              </div>

              {savingsBox.status !== 'ACTIVE' ? (
                <Link to="/box/activate" style={{ marginTop: '6px' }}>
                  <Button variant="primary" size="sm" icon="⚡" style={{ width: '100%' }}>
                    Aktivasi Kotak Sekarang (Pindai NFC)
                  </Button>
                </Link>
              ) : (
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <Link to="/accounts/apply" style={{ flex: 1 }}>
                    <Button variant="outline" size="sm" icon="📝" style={{ width: '100%' }}>
                      Pesan Tabungan Baru
                    </Button>
                  </Link>
                  <Link to="/box/activate" style={{ flex: 1 }}>
                    <Button variant="ghost" size="sm" icon="📦" style={{ width: '100%' }}>
                      Cek Status Kotak
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', marginBottom: '16px' }}>
                Anda belum memiliki kotak tabungan fisik ber-NFC atau kotak sedang disiapkan oleh Admin.
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/accounts/apply">
                  <Button variant="primary" size="sm" icon="📝">Pesan Kotak Tabungan</Button>
                </Link>
                <Link to="/box/activate">
                  <Button variant="secondary" size="sm">Cek Status Pengiriman</Button>
                </Link>
              </div>
            </div>
          )}
        </Card>

        {/* Prinsip Tabungan Mandiri Card */}
        <Card
          variant="glass"
          title="🛡️ Prinsip Tabungan Mandiri"
          action={
            <Link to="/physical-balance" style={{ fontSize: '11px', color: 'var(--accent2)', fontWeight: '700' }}>
              Kelola Saldo Fisik →
            </Link>
          }
        >
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 16px' }}>
            Uang fisik Anda tersimpan aman di rumah dalam kotak tabungan NFC. Sistem bertindak sebagai pembukuan digital resmi. Setiap transaksi setor atau tarik wajib diverifikasi melalui scan NFC pada kotak tabungan.
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/goals" style={{ flex: 1 }}>
              <Button variant="secondary" size="sm" icon="🎯" style={{ width: '100%' }}>Target Tabungan</Button>
            </Link>
            <Link to="/reports" style={{ flex: 1 }}>
              <Button variant="secondary" size="sm" icon="📄" style={{ width: '100%' }}>Cetak Rekening</Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* ─── Riwayat Transaksi Terbaru (ResponsiveTable Standard 2026) ─── */}
      <Card
        variant="surface"
        title="📜 Riwayat Transaksi Terbaru"
        subtitle="Daftar 10 mutasi setoran dan penarikan tabungan mandiri terkini"
        action={
          <Link to="/transactions" style={{ fontSize: '12px', color: 'var(--accent2)', fontWeight: '700' }}>
            Lihat Semua Transaksi →
          </Link>
        }
      >
        <ResponsiveTable
          columns={transactionColumns}
          data={recentTransactions}
          keyField="id"
          emptyMessage="Belum ada transaksi. Silakan lakukan setoran pertama ke kotak tabungan Anda."
        />
      </Card>
    </div>
  )
}
