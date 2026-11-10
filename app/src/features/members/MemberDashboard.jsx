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

  // Dynamic UI States
  const [activeTab, setActiveTab] = useState('overview') // 'overview', 'box', 'history', 'reconcile'
  const [showBalance, setShowBalance] = useState(true)
  const [txFilter, setTxFilter] = useState('ALL') // 'ALL', 'DEPOSIT', 'WITHDRAWAL'
  const [txSearch, setTxSearch] = useState('')
  const [liveTime, setLiveTime] = useState(new Date().toLocaleTimeString('id-ID'))

  // Aggregated KPI
  const [totalDeposit, setTotalDeposit] = useState(0)
  const [totalWithdrawal, setTotalWithdrawal] = useState(0)

  // Digital Live Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(new Date().toLocaleTimeString('id-ID'))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

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
        .limit(20)

      if (txs) {
        setRecentTransactions(txs)

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

  // Greeting dinamis berdasarkan waktu
  const getDynamicGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 11) return 'Selamat Pagi'
    if (hour < 15) return 'Selamat Siang'
    if (hour < 18) return 'Selamat Sore'
    return 'Selamat Malam'
  }

  // Filter transaksi aktif
  const filteredTransactions = recentTransactions.filter((tx) => {
    if (txFilter === 'DEPOSIT' && tx.transaction_type !== 'DEPOSIT') return false
    if (txFilter === 'WITHDRAWAL' && tx.transaction_type !== 'WITHDRAWAL') return false
    if (txSearch) {
      const q = txSearch.toLowerCase()
      const matchNum = tx.transaction_number?.toLowerCase().includes(q)
      const matchDesc = tx.description?.toLowerCase().includes(q)
      return matchNum || matchDesc
    }
    return true
  })

  if (loading) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--fg-muted)', fontSize: '14px', fontWeight: '600' }}>
          Menghubungkan ke jaringan realtime tabungan mandiri...
        </p>
      </div>
    )
  }

  // JIKA BELUM MEMILIKI REKENING
  if (accounts.length === 0) {
    if (pendingApplication && (pendingApplication.status === 'PENDING' || pendingApplication.status === 'UNDER_REVIEW')) {
      return (
        <div style={{ maxWidth: '820px', margin: '30px auto', padding: '0 20px' }} className="dynamic-fade-in">
          <div className="card" style={{ padding: '36px 30px', border: '1px solid rgba(195, 154, 88, 0.4)', background: 'rgba(23, 33, 45, 0.85)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '16px',
                background: 'rgba(245, 166, 35, 0.15)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '26px',
                border: '1px solid rgba(245, 166, 35, 0.3)',
              }}>⏳</div>
              <div>
                <span className="status wait" style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '0.04em' }}>
                  STATUS PENGAJUAN: {pendingApplication.status}
                </span>
                <h2 style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: '900', letterSpacing: '-0.02em' }}>
                  Pengajuan Rekening Sedang Ditinjau Admin
                </h2>
              </div>
            </div>

            <p style={{ color: 'var(--fg-muted)', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px' }}>
              Pengajuan pembukaan rekening <strong>{pendingApplication.account_type}</strong> Anda telah berhasil diterima oleh sistem pada <strong>{formatDateTime(pendingApplication.created_at)}</strong> dan saat ini dalam antrean verifikasi oleh Admin Bank.
            </p>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '14px',
              padding: '18px 22px',
              marginBottom: '24px',
              border: '1px solid var(--border)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
            }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--fg-muted)', display: 'block' }}>Jenis Rekening</span>
                <strong style={{ fontSize: '15px', color: 'var(--accent2)' }}>{pendingApplication.account_type}</strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--fg-muted)', display: 'block' }}>Rencana Setoran Awal</span>
                <strong style={{ fontSize: '15px' }}>{formatRupiah(pendingApplication.initial_deposit)}</strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--fg-muted)', display: 'block' }}>Fasilitas Tabungan</span>
                <strong style={{ fontSize: '15px', color: '#65d69a' }}>Kotak Fisik NFC Mandiri</strong>
              </div>
            </div>

            <div style={{
              padding: '16px 20px',
              borderRadius: '12px',
              background: 'rgba(23, 107, 85, 0.15)',
              border: '1px solid rgba(23, 107, 85, 0.3)',
              marginBottom: '26px',
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
                className="btn btn-emerald"
              >
                {approving ? 'Memproses Persetujuan...' : '⚡ [Mode Uji Coba] Setujui & Terbitkan Rekening Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={{ maxWidth: '740px', margin: '40px auto', padding: '0 20px' }} className="dynamic-fade-in">
        <div className="card" style={{ textAlign: 'center', padding: '48px 30px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(23, 107, 85, 0.25), rgba(195, 154, 88, 0.2))',
            display: 'grid',
            placeItems: 'center',
            fontSize: '32px',
            margin: '0 auto 20px',
            border: '1px solid rgba(195, 154, 88, 0.3)',
          }}>🏦</div>
          <h2 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: '900' }}>
            Selamat Datang di Narayan Virtual Bank
          </h2>
          <p style={{ color: 'var(--fg-muted)', maxWidth: '540px', margin: '0 auto 28px', lineHeight: '1.6', fontSize: '14px' }}>
            Anda belum memiliki rekening tabungan aktif. Ajukan pembukaan rekening mandiri sekarang untuk mendapatkan fasilitas kotak tabungan fisik NFC dan mulai menabung di rumah.
          </p>
          <Link to="/accounts/apply" className="btn btn-primary" style={{ padding: '14px 32px', fontSize: '15px' }}>
            📝 Ajukan Rekening Tabungan Baru
          </Link>
        </div>
      </div>
    )
  }

  // JIKA SUDAH MEMILIKI REKENING AKTIF
  return (
    <div style={{ maxWidth: '1160px', margin: '10px auto 70px', padding: '0 20px' }} className="dynamic-fade-in">
      {/* Dynamic Hero Greeting Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(23, 107, 85, 0.32) 0%, rgba(13, 27, 42, 0.7) 50%, rgba(195, 154, 88, 0.2) 100%)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(220, 230, 240, 0.12)',
        borderRadius: '24px',
        padding: '28px 32px',
        marginBottom: '22px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Glow Accent Orb */}
        <div style={{
          position: 'absolute',
          top: '-30px',
          right: '-30px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'rgba(195, 154, 88, 0.15)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }} />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--accent2)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Portal Tabungan Mandiri
            </span>
            <span style={{ color: 'var(--border)' }}>•</span>
            <span style={{ fontSize: '11px', color: '#65d69a', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="live-pulse" /> {liveTime} WIB
            </span>
          </div>

          <h1 style={{ margin: '0 0 8px', fontSize: '26px', fontWeight: '900', letterSpacing: '-0.02em', color: '#ffffff' }}>
            {getDynamicGreeting()}, {profile?.full_name || 'Member'} 👋
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{
              padding: '4px 10px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.06)',
              fontSize: '12px',
              color: '#edf2f7',
              fontFamily: 'var(--font-mono)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}>
              No. Rekening: <strong>{activeAccount?.account_number}</strong>
            </span>
            <span className={`status ${activeAccount?.status === 'ACTIVE' ? 'good' : 'bad'}`}>
              ● {activeAccount?.status === 'ACTIVE' ? 'Rekening Aktif' : activeAccount?.status}
            </span>
          </div>
        </div>

        {/* Dynamic Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/deposit" className="btn btn-primary" style={{ padding: '12px 20px' }}>
            📥 Setor Tabungan
          </Link>
          <Link to="/withdrawal" className="btn btn-secondary" style={{ padding: '12px 20px' }}>
            📤 Tarik Tabungan
          </Link>
          <Link to="/" className="btn btn-secondary" style={{ padding: '12px 18px' }} title="Buka Kantor 3D">
            🏛️ Kantor 3D
          </Link>
        </div>
      </div>

      {/* Dynamic Tab Navigation */}
      <div className="dynamic-tabs">
        <button
          className={`dynamic-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Ringkasan & Saldo
        </button>
        <button
          className={`dynamic-tab ${activeTab === 'box' ? 'active' : ''}`}
          onClick={() => setActiveTab('box')}
        >
          📦 Kotak Tabungan & NFC
        </button>
        <button
          className={`dynamic-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 Mutasi & Riwayat
        </button>
        <button
          className={`dynamic-tab ${activeTab === 'reconcile' ? 'active' : ''}`}
          onClick={() => setActiveTab('reconcile')}
        >
          ⚖️ Rekonsiliasi Saldo Fisik
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: OVERVIEW & RINGKASAN SALDO                             */}
      {/* ============================================================== */}
      {activeTab === 'overview' && (
        <div className="dynamic-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Main Visual Saldo Meter & Reconciliation Card */}
          <div className="card" style={{
            background: 'linear-gradient(135deg, rgba(23, 33, 45, 0.85) 0%, rgba(15, 24, 35, 0.95) 100%)',
            border: '1px solid rgba(195, 154, 88, 0.28)',
            padding: '24px 28px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800' }}>
                  Saldo Pembukuan Resmi
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                  <h2 style={{ margin: 0, fontSize: '32px', fontWeight: '900', color: 'var(--accent2)', letterSpacing: '-0.02em' }}>
                    {showBalance ? formatRupiah(bookBalance) : 'Rp ••••••••••'}
                  </h2>
                  <button
                    onClick={() => setShowBalance(!showBalance)}
                    className="btn btn-sm btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '13px' }}
                    title="Sembunyikan/Tampilkan Saldo"
                  >
                    {showBalance ? '👁️ Sembunyikan' : '🙈 Tampilkan'}
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: 'var(--fg-muted)', display: 'block' }}>Status Rekonsiliasi Fisik</span>
                <span className={`status ${difference === 0 ? 'good' : (difference === null ? 'wait' : 'bad')}`} style={{ fontSize: '12px', padding: '5px 12px', marginTop: '4px' }}>
                  {difference === 0 ? '✅ 100% Sesuai & Cocok' : (difference === null ? 'Belum Ada Laporan Fisik' : `⚠️ Selisih: ${formatRupiah(difference)}`)}
                </span>
              </div>
            </div>

            {/* Reconciliation Comparison Progress Bar */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px', color: 'var(--fg-muted)' }}>
                <span>Buku Digital: <b>{showBalance ? formatRupiah(bookBalance) : 'Rp ••••'}</b></span>
                <span>Fisik Dilaporkan: <b>{showBalance ? (reportedBalance !== null ? formatRupiah(reportedBalance) : 'Rp 0') : 'Rp ••••'}</b></span>
              </div>
              <div style={{
                height: '10px',
                borderRadius: '99px',
                background: 'rgba(255, 255, 255, 0.08)',
                overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (reportedBalance && bookBalance > 0 ? (reportedBalance / bookBalance) * 100 : (bookBalance > 0 ? 100 : 0)))}%`,
                  background: difference === 0 ? 'linear-gradient(90deg, #10b981, #2ecc71)' : 'linear-gradient(90deg, #f59e0b, #e74c3c)',
                  borderRadius: '99px',
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>

            {/* Quick Deposit Preset Chips */}
            <div style={{ marginTop: '22px', borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--fg-muted)', fontWeight: '700' }}>⚡ Setor Cepat:</span>
              {[50000, 100000, 200000, 500000].map((amt) => (
                <Link
                  key={amt}
                  to={`/deposit?amount=${amt}`}
                  className="btn btn-sm btn-secondary"
                  style={{ borderRadius: '20px', padding: '5px 14px', fontSize: '11px', fontWeight: '800' }}
                >
                  +{formatRupiah(amt)}
                </Link>
              ))}
            </div>
          </div>

          {/* 5-KPI Grid */}
          <div className="kpi-grid">
            <div className="kpi-item" style={{ borderLeft: '4px solid #c39a58' }}>
              <span className="kpi-label">Saldo Pembukuan</span>
              <b className="kpi-value" style={{ color: 'var(--accent2)' }}>
                {showBalance ? formatRupiah(bookBalance) : 'Rp ••••••••'}
              </b>
              <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Tercatat di server</small>
            </div>

            <div className="kpi-item" style={{ borderLeft: '4px solid #2ecc71' }}>
              <span className="kpi-label">Total Setoran</span>
              <b className="kpi-value" style={{ color: '#65d69a' }}>
                {showBalance ? formatRupiah(totalDeposit) : 'Rp ••••••••'}
              </b>
              <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Uang masuk ke kotak</small>
            </div>

            <div className="kpi-item" style={{ borderLeft: '4px solid #e74c3c' }}>
              <span className="kpi-label">Total Penarikan</span>
              <b className="kpi-value" style={{ color: '#ff8a80' }}>
                {showBalance ? formatRupiah(totalWithdrawal) : 'Rp ••••••••'}
              </b>
              <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Uang ditarik fisik</small>
            </div>

            <div className="kpi-item" style={{ borderLeft: '4px solid #3498db' }}>
              <span className="kpi-label">Saldo Fisik Terlapor</span>
              <b className="kpi-value" style={{ color: '#74c0e8' }}>
                {showBalance ? (reportedBalance !== null ? formatRupiah(reportedBalance) : 'Belum Lapor') : 'Rp ••••••••'}
              </b>
              <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Uang riil di kotak</small>
            </div>

            <div className="kpi-item" style={{ borderLeft: difference === 0 ? '4px solid #2ecc71' : '4px solid #f39c12' }}>
              <span className="kpi-label">Selisih Rekonsiliasi</span>
              <b className="kpi-value" style={{ color: difference === 0 ? '#65d69a' : '#f39c12' }}>
                {difference !== null ? (difference === 0 ? 'Sesuai (Rp 0)' : formatRupiah(difference)) : '-'}
              </b>
              <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>
                {difference === 0 ? '✅ Selaras sempurna' : 'Perlu pencocokan'}
              </small>
            </div>
          </div>

          {/* Quick Dual Cards: Kotak Tabungan & Riwayat Terakhir */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Kotak Fisik Card */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">📦 Kotak Tabungan Fisik</h3>
                <span className={`status ${savingsBox?.status === 'ACTIVE' ? 'good' : 'wait'}`}>
                  {formatBoxStatus(savingsBox?.status || 'PREPARING')}
                </span>
              </div>

              {savingsBox ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                    <span style={{ color: 'var(--fg-muted)' }}>Kode Kotak:</span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{savingsBox.box_code}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                    <span style={{ color: 'var(--fg-muted)' }}>Sensor Web NFC:</span>
                    <span className="status good">NDEF Siap Digunakan</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                    <span style={{ color: 'var(--fg-muted)' }}>Aktivasi:</span>
                    <span>{savingsBox.activated_at ? formatDateTime(savingsBox.activated_at) : 'Belum diaktifkan'}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    <Link to="/box/activate" className="btn btn-sm btn-primary" style={{ flex: 1 }}>
                      {savingsBox.status === 'ACTIVE' ? 'Periksa Kotak NFC' : '⚡ Aktivasi Kotak'}
                    </Link>
                    <Link to="/physical-balance" className="btn btn-sm btn-secondary" style={{ flex: 1 }}>
                      ⚖️ Lapor Saldo Fisik
                    </Link>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <p style={{ color: 'var(--fg-muted)', fontSize: '13px', marginBottom: '14px' }}>
                    Kotak tabungan fisik Anda sedang disiapkan oleh Admin Bank.
                  </p>
                  <Link to="/box/activate" className="btn btn-secondary btn-sm">
                    Lihat Status Pengiriman Kotak
                  </Link>
                </div>
              )}
            </div>

            {/* Target Tabungan & Laporan Card */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">🎯 Rencana Tabungan & Laporan</h3>
                <Link to="/goals" style={{ fontSize: '12px', color: 'var(--accent2)', fontWeight: '700' }}>
                  Kelola Target →
                </Link>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--fg-muted)', lineHeight: '1.6', margin: '0 0 16px' }}>
                Setiap setoran dan penarikan yang Anda lakukan di kotak fisik di rumah tercatat secara permanen di buku besar sistem. Gunakan laporan periodik untuk evaluasi keuangan Anda.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Link to="/goals" className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                  🎯 Rencana Masa Depan
                </Link>
                <Link to="/reports" className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                  📄 Cetak Laporan PDF
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: KOTAK TABUNGAN & WEB NFC TRACKER                       */}
      {/* ============================================================== */}
      {activeTab === 'box' && (
        <div className="dynamic-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">📦 Integrasi Kotak Tabungan Mandiri & NFC</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: '12px' }}>
                  Identitas fisik kotak tabungan Anda terhubung secara kriptografis via tag NDEF NFC.
                </p>
              </div>
              <span className={`status ${savingsBox?.status === 'ACTIVE' ? 'good' : 'wait'}`}>
                {formatBoxStatus(savingsBox?.status || 'PREPARING')}
              </span>
            </div>

            {savingsBox ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* 4-Stage Shipment Progress Tracker */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '20px',
                  borderRadius: '16px',
                  border: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--fg-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '14px' }}>
                    Alur Penyiapan & Pengiriman Kotak
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center' }}>
                    {['PREPARING', 'READY_TO_SHIP', 'SHIPPED', 'ACTIVE'].map((st, idx) => {
                      const stages = ['PREPARING', 'READY_TO_SHIP', 'SHIPPED', 'ACTIVE']
                      const curIdx = stages.indexOf(savingsBox.status || 'PREPARING')
                      const isPassed = curIdx >= idx
                      const isCurrent = curIdx === idx

                      return (
                        <div key={st} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: isPassed ? 'linear-gradient(135deg, #10b981, #176b55)' : 'rgba(255,255,255,0.06)',
                            border: isCurrent ? '2px solid var(--accent)' : 'none',
                            color: isPassed ? '#fff' : 'var(--fg-muted)',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: '800',
                            fontSize: '12px',
                          }}>
                            {isPassed ? '✓' : idx + 1}
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: isCurrent ? '800' : '600', color: isPassed ? '#edf2f7' : 'var(--fg-muted)' }}>
                            {st === 'PREPARING' ? 'Disiapkan' : st === 'READY_TO_SHIP' ? 'Siap Kirim' : st === 'SHIPPED' ? 'Dikirim' : 'Aktif'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Box Technical Details */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '14px',
                }}>
                  <div style={{ padding: '14px 18px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--fg-muted)', display: 'block' }}>Kode Unik Kotak</span>
                    <strong style={{ fontSize: '15px', fontFamily: 'var(--font-mono)' }}>{savingsBox.box_code}</strong>
                  </div>
                  <div style={{ padding: '14px 18px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--fg-muted)', display: 'block' }}>Format NDEF Tag</span>
                    <strong style={{ fontSize: '13px', color: 'var(--accent2)' }}>URL Record Mandiri</strong>
                  </div>
                  <div style={{ padding: '14px 18px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--fg-muted)', display: 'block' }}>Tanggal Diterima</span>
                    <strong style={{ fontSize: '13px' }}>{savingsBox.received_at ? formatDateTime(savingsBox.received_at) : 'Menunggu Penerimaan'}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <Link to="/nfc/scan" className="btn btn-secondary">
                    📡 Uji Pindai Tag NFC
                  </Link>
                  <Link to="/box/activate" className="btn btn-primary">
                    ⚡ Halaman Aktivasi Kotak
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                <p style={{ color: 'var(--fg-muted)', marginBottom: '16px' }}>
                  Belum ada data kotak tabungan fisik yang ditugaskan ke rekening Anda.
                </p>
                <Link to="/box/activate" className="btn btn-secondary">
                  Buka Menu Aktivasi Kotak
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: MUTASI & RIWAYAT TRANSAKSI                              */}
      {/* ============================================================== */}
      {activeTab === 'history' && (
        <div className="dynamic-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">📜 Buku Mutasi Tabungan</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: '12px' }}>
                  Catatan pembukuan ganda tak terhapus (immutable double-entry ledger).
                </p>
              </div>
              <Link to="/transactions" className="btn btn-sm btn-secondary">
                Lihat Seluruh Halaman →
              </Link>
            </div>

            {/* Filter and Search Bar */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['ALL', 'DEPOSIT', 'WITHDRAWAL'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setTxFilter(f)}
                    className={`btn btn-sm ${txFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ borderRadius: '20px' }}
                  >
                    {f === 'ALL' ? 'Semua' : f === 'DEPOSIT' ? '📥 Setoran' : '📤 Penarikan'}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Cari nomor transaksi / catatan..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="form-field"
                style={{ flex: 1, minWidth: '220px', padding: '8px 14px' }}
              />
            </div>

            {filteredTransactions.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--fg-muted)' }}>
                      <th style={{ padding: '10px 14px' }}>No. Transaksi</th>
                      <th style={{ padding: '10px 14px' }}>Waktu</th>
                      <th style={{ padding: '10px 14px' }}>Jenis</th>
                      <th style={{ padding: '10px 14px' }}>Nominal</th>
                      <th style={{ padding: '10px 14px' }}>Sumber</th>
                      <th style={{ padding: '10px 14px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid rgba(220, 230, 240, 0.05)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: '800', fontFamily: 'var(--font-mono)' }}>
                          {tx.transaction_number}
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--fg-muted)' }}>
                          {formatDateTime(tx.created_at)}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: '800',
                            background: tx.transaction_type === 'DEPOSIT' ? 'rgba(46, 204, 113, 0.16)' : 'rgba(231, 76, 60, 0.16)',
                            color: tx.transaction_type === 'DEPOSIT' ? '#65d69a' : '#ff8a80',
                          }}>
                            {tx.transaction_type === 'DEPOSIT' ? '📥 Setoran' : '📤 Penarikan'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '900', color: tx.transaction_type === 'DEPOSIT' ? '#65d69a' : '#ff8a80' }}>
                          {tx.transaction_type === 'DEPOSIT' ? '+' : '-'}{formatRupiah(tx.amount)}
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--fg-muted)', fontSize: '12px' }}>
                          {tx.source === 'NFC' ? '🏷️ NFC Tag' : '📱 Aplikasi'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
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
              <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--fg-muted)' }}>
                Tidak ada transaksi yang cocok dengan filter.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: REKONSILIASI SALDO FISIK                                */}
      {/* ============================================================== */}
      {activeTab === 'reconcile' && (
        <div className="dynamic-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">⚖️ Rekonsiliasi Saldo Fisik Mandiri</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: '12px' }}>
                  Cocokkan uang tunai yang tersimpan di dalam kotak tabungan dengan catatan sistem.
                </p>
              </div>
              <Link to="/physical-balance" className="btn btn-primary btn-sm">
                📝 Buat Laporan Saldo Fisik Baru
              </Link>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid var(--border)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '20px',
            }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--fg-muted)', display: 'block' }}>Saldo Pembukuan Sistem</span>
                <strong style={{ fontSize: '24px', color: 'var(--accent2)', display: 'block', margin: '4px 0' }}>
                  {formatRupiah(bookBalance)}
                </strong>
                <small style={{ color: 'var(--fg-muted)' }}>Berdasarkan seluruh transaksi resmi yang tercatat</small>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: 'var(--fg-muted)', display: 'block' }}>Saldo Fisik Terakhir Dilaporkan</span>
                <strong style={{ fontSize: '24px', color: '#74c0e8', display: 'block', margin: '4px 0' }}>
                  {reportedBalance !== null ? formatRupiah(reportedBalance) : 'Belum Pernah Melapor'}
                </strong>
                <small style={{ color: 'var(--fg-muted)' }}>
                  {physicalReport ? `Dilaporkan pada ${formatDateTime(physicalReport.created_at)}` : 'Hitung uang fisik di kotak Anda'}
                </small>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: 'var(--fg-muted)', display: 'block' }}>Status Keselarasan</span>
                <strong style={{
                  fontSize: '24px',
                  color: difference === 0 ? '#65d69a' : (difference === null ? 'var(--fg-muted)' : '#f39c12'),
                  display: 'block',
                  margin: '4px 0',
                }}>
                  {difference === 0 ? 'Sesuai (Rp 0)' : (difference !== null ? formatRupiah(difference) : '-')}
                </strong>
                <small style={{ color: 'var(--fg-muted)' }}>
                  {difference === 0 ? '✅ Pembukuan dan fisik 100% cocok' : 'Disarankan melapor saat ada uang fisik masuk/keluar'}
                </small>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Link to="/physical-balance" className="btn btn-secondary">
                Lihat Seluruh Riwayat Laporan Fisik →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
