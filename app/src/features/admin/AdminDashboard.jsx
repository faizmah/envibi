import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { subscribeToAllApplications } from '../../services/realtime/realtimeService';

import { formatRupiah, formatDateTime } from '../../utils/format'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [recentAudit, setRecentAudit] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)

    // Panggil RPC get_admin_dashboard_data (fallback to manual query if RPC unavailable)
    const { data: dashData, error: rpcError } = await supabase.rpc('get_admin_dashboard_data')
    if (dashData?.ok) {
      setStats(dashData)
    } else {
      // Fallback: hit the table directly for pending applications count
      const { count: pendingCount, error: cntErr } = await supabase
        .from('account_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING')
      // Preserve any previously fetched stats (if any) and inject pending count
      setStats(prev => ({
        ...(prev || {}),
        pending_applications: pendingCount ?? 0,
      }))
    }

    // Ambil log aktivitas terbaru
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8)

    if (logs) setRecentAudit(logs)
    setLoading(false)
  }

  useEffect(() => {
  loadData();
  const unsub = subscribeToAllApplications(() => loadData());
  return () => unsub?.();
}, []);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--fg-muted)' }}>Memuat ringkasan operasional bank...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Title */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800' }}>Ringkasan Operasional Bank</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: '12px' }}>
          Monitoring menyeluruh member, rekening, pengiriman kotak fisik, dan perputaran saldo
        </p>
      </div>

      {/* KPI Grid Section 9.A */}
      <div className="kpi-grid" style={{ marginBottom: '28px' }}>
        <div className="kpi-item" style={{ borderLeft: '4px solid var(--accent)' }}>
          <span className="kpi-label">Total Saldo Pembukuan</span>
          <b className="kpi-value" style={{ color: 'var(--accent2)' }}>
            {formatRupiah(stats?.total_book_balance || 0)}
          </b>
          <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Total simpanan nasabah</small>
        </div>

        <div className="kpi-item" style={{ borderLeft: '4px solid #2ecc71' }}>
          <span className="kpi-label">Rekening Aktif</span>
          <b className="kpi-value" style={{ color: '#65d69a' }}>
            {stats?.total_active_accounts || 0}
          </b>
          <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Dari {stats?.total_members || 0} member</small>
        </div>

        <div className="kpi-item" style={{ borderLeft: '4px solid #f39c12' }}>
          <span className="kpi-label">Pengajuan Rekening Baru</span>
          <b className="kpi-value" style={{ color: '#f39c12' }}>
            {stats?.pending_applications || 0}
          </b>
          <Link to="/admin/accounts" style={{ fontSize: '10px', color: 'var(--accent2)' }}>
            Periksa sekarang →
          </Link>
        </div>

        <div className="kpi-item" style={{ borderLeft: '4px solid #3498db' }}>
          <span className="kpi-label">Kotak Disiapkan / Dikirim</span>
          <b className="kpi-value">
            {(stats?.preparing_boxes || 0) + (stats?.shipped_boxes || 0)}
          </b>
          <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>
            {stats?.active_boxes || 0} kotak telah aktif
          </small>
        </div>

        <div className="kpi-item" style={{ borderLeft: '4px solid #9b59b6' }}>
          <span className="kpi-label">Setoran Hari Ini</span>
          <b className="kpi-value" style={{ color: '#65d69a' }}>
            {formatRupiah(stats?.total_deposits_today || 0)}
          </b>
          <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Mutasi kas masuk</small>
        </div>

        <div className="kpi-item" style={{ borderLeft: '4px solid #e74c3c' }}>
          <span className="kpi-label">Penarikan Hari Ini</span>
          <b className="kpi-value" style={{ color: '#ff8a80' }}>
            {formatRupiah(stats?.total_withdrawals_today || 0)}
          </b>
          <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Mutasi kas keluar</small>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="card">
          <h3 className="card-title">📝 Persetujuan Pembukaan Rekening</h3>
          <p style={{ color: 'var(--fg-muted)', fontSize: '12px', lineHeight: '1.5' }}>
            Terdapat <b>{stats?.pending_applications || 0}</b> permohonan pembukaan rekening yang menunggu verifikasi admin.
          </p>
          <Link to="/admin/accounts" className="btn btn-primary btn-sm">
            Tinjau Permohonan Rekening
          </Link>
        </div>

        <div className="card">
          <h3 className="card-title">📦 Penyiapan Kotak & Tulis NFC</h3>
          <p style={{ color: 'var(--fg-muted)', fontSize: '12px', lineHeight: '1.5' }}>
            Tulis URL NDEF identitas ke tag NFC fisik dan masukkan nomor resi kurir pengiriman ke rumah member.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link to="/admin/nfc" className="btn btn-primary btn-sm">Tulis NFC</Link>
            <Link to="/admin/boxes" className="btn btn-secondary btn-sm">Kirim Kotak</Link>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">💸 Validasi Transaksi Realtime</h3>
          <p style={{ color: 'var(--fg-muted)', fontSize: '12px', lineHeight: '1.5' }}>
            Pantau seluruh aliran setor dan tarik mandiri member secara realtime tanpa refresh halaman.
          </p>
          <Link to="/admin/transactions" className="btn btn-secondary btn-sm">
            Buka Monitor Transaksi
          </Link>
        </div>
      </div>

      {/* Recent Audit Trail Log */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🛡️ Log Aktivitas Terbaru (Audit Trail)</h3>
          <Link to="/admin/audit" style={{ fontSize: '12px', color: 'var(--accent2)' }}>
            Lihat Semua Log →
          </Link>
        </div>

        {recentAudit.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentAudit.map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              >
                <div>
                  <span style={{ fontWeight: '800', color: 'var(--accent2)' }}>{log.action}</span>
                  <span style={{ color: 'var(--fg-muted)', marginLeft: '10px' }}>
                    Entitas: {log.entity_type}
                  </span>
                </div>
                <span style={{ color: 'var(--fg-muted)', fontSize: '11px' }}>
                  {formatDateTime(log.created_at)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--fg-muted)', fontSize: '12px', textAlign: 'center', margin: '20px 0' }}>
            Belum ada aktivitas tercatat.
          </p>
        )}
      </div>
    </div>
  )
}

