import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../services/supabase/client'
import { useAuth } from '../../app/providers/AuthProvider'
import { subscribeToAllApplications } from '../../services/realtime/realtimeService'
import { formatRupiah, formatDateTime } from '../../utils/format'

export default function AdminDashboard() {
  const { user, role } = useAuth()
  const [stats, setStats] = useState(null)
  const [recentAudit, setRecentAudit] = useState([])
  const [pendingApps, setPendingApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)

  // Quick Action Modal for Applications
  const [selectedApp, setSelectedApp] = useState(null)
  const [actionType, setActionType] = useState('approve')
  const [adminNotes, setAdminNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [actionFeedback, setActionFeedback] = useState('')
  const [actionError, setActionError] = useState('')

  const loadData = async () => {
    setLoading(true)
    setAccessDenied(false)

    // 1. Panggil RPC get_admin_dashboard_data
    let dashStats = null
    try {
      const { data: dashData, error: rpcErr } = await supabase.rpc('get_admin_dashboard_data')
      if (dashData?.ok) {
        dashStats = dashData
      } else if (dashData?.error?.includes('Akses ditolak') || rpcErr?.message?.includes('Akses ditolak')) {
        setAccessDenied(true)
      }
    } catch (e) {
      console.warn('RPC check warn:', e)
    }

    // 2. Ambil data pengajuan rekening secara aman (ambil raw lalu join profil secara mandiri)
    let appsWithProfiles = []
    try {
      const { data: rawApps, error: appsErr } = await supabase
        .from('account_applications')
        .select('*')
        .order('created_at', { ascending: false })

      if (rawApps && rawApps.length > 0) {
        const userIds = [...new Set(rawApps.map((a) => a.user_id).filter(Boolean))]
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, email, phone')
            .in('id', userIds)
          const profMap = new Map((profs || []).map((p) => [p.id, p]))
          appsWithProfiles = rawApps.map((a) => ({
            ...a,
            profiles: profMap.get(a.user_id) || { full_name: 'Member', email: '-' },
          }))
        } else {
          appsWithProfiles = rawApps
        }
      }
    } catch (err) {
      console.error('Error fetching applications in dashboard:', err)
    }

    setPendingApps(appsWithProfiles)

    // Hitung jumlah pending secara langsung dari tabel jika RPC gagal
    const pendingCount = appsWithProfiles.filter(
      (a) => a.status === 'PENDING' || a.status === 'UNDER_REVIEW'
    ).length

    setStats((prev) => ({
      ...(dashStats || prev || {}),
      pending_applications: dashStats?.pending_applications ?? pendingCount,
    }))

    // 3. Ambil log audit terbaru
    try {
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6)
      if (logs) setRecentAudit(logs)
    } catch (e) {
      console.warn('Audit logs warn:', e)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
    const unsub = subscribeToAllApplications(() => loadData())
    return () => unsub?.()
  }, [])

  const handleOpenDecision = (app, type) => {
    setSelectedApp(app)
    setActionType(type)
    setAdminNotes('')
    setActionError('')
    setActionFeedback('')
  }

  const handleExecuteDecision = async () => {
    if (!selectedApp) return
    setProcessing(true)
    setActionError('')
    setActionFeedback('')

    let rpcName = ''
    let rpcParams = {}

    if (actionType === 'approve') {
      rpcName = 'approve_account_application'
      rpcParams = {
        p_application_id: selectedApp.id,
        p_admin_notes: adminNotes.trim() || 'Disetujui oleh Administrator Bank',
      }
    } else if (actionType === 'reject') {
      rpcName = 'reject_account_application'
      rpcParams = {
        p_application_id: selectedApp.id,
        p_reason: adminNotes.trim() || 'Persyaratan belum terpenuhi',
      }
    }

    try {
      const { data, error } = await supabase.rpc(rpcName, rpcParams)
      setProcessing(false)

      if (error || !data?.ok) {
        // Fallback update langsung jika RPC belum siap
        const updateStatus = actionType === 'approve' ? 'APPROVED' : 'REJECTED'
        const { error: directErr } = await supabase
          .from('account_applications')
          .update({
            status: updateStatus,
            admin_notes: adminNotes.trim() || (actionType === 'approve' ? 'Disetujui' : 'Ditolak'),
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', selectedApp.id)

        if (directErr) {
          setActionError(error?.message || directErr.message || 'Gagal memproses keputusan.')
          return
        }
      }

      setActionFeedback(`Pengajuan berhasil di-${actionType === 'approve' ? 'SETUJUI' : 'TOLAK'}!`)
      setTimeout(() => {
        setSelectedApp(null)
        loadData()
      }, 1000)
    } catch (e) {
      setProcessing(false)
      setActionError(e.message || 'Terjadi kesalahan sistem.')
    }
  }

  const sqlAdminScript = `-- Jalankan SQL ini di Supabase SQL Editor untuk memberikan hak ADMIN penuh:
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'ADMIN'
FROM auth.users
WHERE email = '${user?.email || 'email_admin_anda@gmail.com'}'
ON CONFLICT (user_id, role) DO UPDATE SET role = 'ADMIN';

UPDATE public.user_roles
SET role = 'ADMIN'
WHERE user_id = (SELECT id FROM auth.users WHERE email = '${user?.email || 'email_admin_anda@gmail.com'}');`

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlAdminScript)
    setCopiedSql(true)
    setTimeout(() => setCopiedSql(false), 3000)
  }

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
      {/* Title & Refresh Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800' }}>Ringkasan Operasional Bank</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: '12px' }}>
            Monitoring menyeluruh member, rekening, pengiriman kotak fisik, dan perputaran saldo
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="btn btn-secondary btn-sm"
          title="Segarkan data terbaru"
        >
          🔄 Refresh Realtime
        </button>
      </div>

      {/* Banner Peringatan Cerdas: Jika akun belum diset sebagai ADMIN di database */}
      {accessDenied && (
        <div style={{
          padding: '16px 20px',
          borderRadius: '14px',
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: '800', fontSize: '14px', marginBottom: '6px' }}>
                <span>⚠️</span>
                <span>Hak Akses Admin Belum Aktif di Supabase Database</span>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: '12.5px', color: 'var(--fg)', lineHeight: '1.5' }}>
                Akun <b>{user?.email}</b> belum terdaftar dengan role <code>ADMIN</code> di tabel <code>public.user_roles</code> Supabase.
                Karena sistem keamanan RLS (Row Level Security), Supabase hanya mengizinkan akun berstatus Admin untuk membaca pengajuan member lain.
              </p>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '11px', color: '#e8c06a', overflowX: 'auto', marginBottom: '10px' }}>
                {sqlAdminScript}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopySql}
              className="btn btn-primary btn-sm"
              style={{ alignSelf: 'center', whiteSpace: 'nowrap' }}
            >
              {copiedSql ? '✅ SQL Tersalin!' : '📋 Salin Query SQL Admin'}
            </button>
          </div>
        </div>
      )}

      {/* KPI Grid Section */}
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
            Periksa antrean lengkap →
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

      {/* TABEL ANTREAN PENGAJUAN REKENING DI DASHBOARD ADMIN */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📝</span>
              <span>Daftar Permohonan Rekening Member ({pendingApps.length})</span>
            </h3>
            <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: '12px' }}>
              Verifikasi dan putuskan pengajuan pembukaan rekening tabungan member secara langsung
            </p>
          </div>
          <Link to="/admin/accounts" className="btn btn-outline btn-sm">
            Buka Kelola Rekening →
          </Link>
        </div>

        {actionFeedback && (
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(46, 204, 113, 0.18)', color: '#65d69a', fontSize: '12px', fontWeight: '700', margin: '14px 0' }}>
            ✅ {actionFeedback}
          </div>
        )}

        {pendingApps.length > 0 ? (
          <div style={{ overflowX: 'auto', marginTop: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--fg-muted)' }}>
                  <th style={{ padding: '10px 12px' }}>Nama Pemohon</th>
                  <th style={{ padding: '10px 12px' }}>Jenis Rekening</th>
                  <th style={{ padding: '10px 12px' }}>Rencana Setoran</th>
                  <th style={{ padding: '10px 12px' }}>Waktu Pengajuan</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Aksi Keputusan</th>
                </tr>
              </thead>
              <tbody>
                {pendingApps.slice(0, 10).map((app) => (
                  <tr key={app.id} style={{ borderBottom: '1px solid rgba(220, 230, 240, 0.05)' }}>
                    <td style={{ padding: '12px' }}>
                      <b style={{ color: 'var(--text-primary)' }}>{app.profiles?.full_name || 'Member'}</b>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--fg-muted)' }}>
                        {app.profiles?.email || app.user_id}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className="badge badge-info">{app.account_type}</span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: '700', color: 'var(--accent2)' }}>
                      {formatRupiah(app.initial_deposit)}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                      {formatDateTime(app.created_at)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className={`status ${
                        app.status === 'APPROVED' ? 'good' :
                        app.status === 'REJECTED' ? 'bad' :
                        app.status === 'REVISION_REQUIRED' ? 'bad' : 'wait'
                      }`}>
                        {app.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {app.status === 'PENDING' || app.status === 'UNDER_REVIEW' || app.status === 'REVISION_REQUIRED' ? (
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-success"
                            onClick={() => handleOpenDecision(app, 'approve')}
                          >
                            Setujui (ACC)
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => handleOpenDecision(app, 'reject')}
                          >
                            Tolak
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--fg-muted)', fontSize: '11px' }}>Selesai Diputuskan</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '30px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', margin: '14px 0' }}>
            <p style={{ color: 'var(--fg-muted)', fontSize: '13px', margin: '0 0 6px' }}>
              Belum ada permohonan pembukaan rekening yang masuk.
            </p>
            <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              Pastikan akun member telah mengirim formulir pembukaan rekening melalui halaman Member.
            </small>
          </div>
        )}
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

      {/* Decision Modal */}
      {selectedApp && (
        <div className="member-portal-overlay">
          <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '16px' }}>
              Keputusan: {actionType === 'approve' ? 'Setujui Rekening' : 'Tolak Rekening'}
            </h3>
            <p style={{ color: 'var(--fg-muted)', fontSize: '12px', margin: '0 0 14px' }}>
              Pemohon: <b>{selectedApp.profiles?.full_name}</b> ({selectedApp.account_type})
            </p>

            {actionError && (
              <div style={{ padding: '8px 12px', background: 'rgba(231, 76, 60, 0.2)', color: '#ff8a80', fontSize: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                {actionError}
              </div>
            )}

            <label className="form-label">Catatan Admin / Alasan Keputusan</label>
            <textarea
              className="form-field"
              rows="3"
              placeholder="Tuliskan catatan untuk member..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedApp(null)}
                disabled={processing}
              >
                Batal
              </button>
              <button
                type="button"
                className={`btn ${actionType === 'approve' ? 'btn-success' : 'btn-danger'}`}
                onClick={handleExecuteDecision}
                disabled={processing}
              >
                {processing ? 'Memproses...' : 'Eksekusi Keputusan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
