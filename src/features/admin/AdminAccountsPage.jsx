import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase/client'
import { subscribeToAllApplications } from '../../services/realtime/realtimeService'
import { formatRupiah, formatDateTime } from '../../utils/format'

export default function AdminAccountsPage() {
  const [applications, setApplications] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  // Decision Modal State
  const [selectedApp, setSelectedApp] = useState(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [actionType, setActionType] = useState('approve') // approve, reject, revise
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const loadData = async () => {
    setLoading(true)

    // 1. Ambil pengajuan rekening secara aman (tanpa mengandalkan embedding FK schema cache)
    const { data: rawApps, error: appsErr } = await supabase
      .from('account_applications')
      .select('*')
      .order('created_at', { ascending: false })

    let appsWithProfiles = rawApps || []
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
      }
    }
    setApplications(appsWithProfiles)

    // 2. Ambil seluruh rekening aktif/beku secara aman
    const { data: rawAccs, error: accsErr } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false })

    let accsWithProfiles = rawAccs || []
    if (rawAccs && rawAccs.length > 0) {
      const userIds = [...new Set(rawAccs.map((a) => a.user_id).filter(Boolean))]
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds)
        const profMap = new Map((profs || []).map((p) => [p.id, p]))
        accsWithProfiles = rawAccs.map((a) => ({
          ...a,
          profiles: profMap.get(a.user_id) || { full_name: 'Member', email: '-' },
        }))
      }
    }
    setAccounts(accsWithProfiles)

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
    setErrorMsg('')
  }

  const handleExecuteDecision = async () => {
    if (!selectedApp) return
    setProcessing(true)
    setErrorMsg('')
    setMessage('')

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
        p_reason: adminNotes.trim() || 'Persyaratan tidak terpenuhi',
      }
    } else if (actionType === 'revise') {
      rpcName = 'request_application_revision'
      rpcParams = {
        p_application_id: selectedApp.id,
        p_notes: adminNotes.trim() || 'Mohon lengkapi data identitas Anda',
      }
    }

    const { data, error } = await supabase.rpc(rpcName, rpcParams)
    setProcessing(false)

    if (error || !data?.ok) {
      setErrorMsg(error?.message || data?.error || 'Keputusan gagal diproses.')
    } else {
      setMessage(`Aksi '${actionType.toUpperCase()}' berhasil diproses secara realtime!`)
      setSelectedApp(null)
      loadData()
    }
  }

  // Toggle freeze/unfreeze account
  const handleToggleAccountStatus = async (acc) => {
    const nextStatus = acc.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    const verb = nextStatus === 'SUSPENDED' ? 'menangguhkan (freeze)' : 'mengaktifkan kembali'

    if (!confirm(`Yakin ingin ${verb} rekening ${acc.account_number}?`)) return

    const { error } = await supabase
      .from('accounts')
      .update({ status: nextStatus })
      .eq('id', acc.id)

    if (!error) loadData()
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>Manajemen Rekening & Persetujuan</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: '12px' }}>
          Tinjau permohonan rekening, terbitkan nomor rekening unik, dan kelola status pembekuan rekening
        </p>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(46, 204, 113, 0.18)', color: '#65d69a', fontSize: '12px', fontWeight: '700', marginBottom: '20px' }}>
          ✅ {message}
        </div>
      )}

      {/* Tabel Permohonan Rekening Menunggu Keputusan */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div className="card-header">
          <h3 className="card-title">📝 Antrean Permohonan Rekening</h3>
          <span className="status wait">
            {applications.filter((a) => a.status === 'PENDING' || a.status === 'UNDER_REVIEW').length} Menunggu
          </span>
        </div>

        {applications.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--fg-muted)' }}>
                  <th style={{ padding: '8px 12px' }}>Pemohon</th>
                  <th style={{ padding: '8px 12px' }}>Jenis Rekening</th>
                  <th style={{ padding: '8px 12px' }}>Rencana Setoran</th>
                  <th style={{ padding: '8px 12px' }}>Waktu</th>
                  <th style={{ padding: '8px 12px' }}>Status</th>
                  <th style={{ padding: '8px 12px' }}>Keputusan Admin</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} style={{ borderBottom: '1px solid rgba(220, 230, 240, 0.05)' }}>
                    <td style={{ padding: '12px' }}>
                      <b>{app.profiles?.full_name || 'Member'}</b>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--fg-muted)' }}>
                        {app.profiles?.email}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>{app.account_type}</td>
                    <td style={{ padding: '12px' }}>{formatRupiah(app.initial_deposit)}</td>
                    <td style={{ padding: '12px', color: 'var(--fg-muted)' }}>{formatDateTime(app.created_at)}</td>
                    <td style={{ padding: '12px' }}>
                      <span className={`status ${
                        app.status === 'APPROVED' ? 'good' :
                        app.status === 'REJECTED' ? 'bad' :
                        app.status === 'REVISION_REQUIRED' ? 'bad' : 'wait'
                      }`}>
                        {app.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {app.status === 'PENDING' || app.status === 'UNDER_REVIEW' || app.status === 'REVISION_REQUIRED' ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-success"
                            onClick={() => handleOpenDecision(app, 'approve')}
                          >
                            Setujui (ACC)
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleOpenDecision(app, 'revise')}
                          >
                            Minta Revisi
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
          <p style={{ color: 'var(--fg-muted)', fontSize: '12px', textAlign: 'center', margin: '20px 0' }}>
            Tidak ada permohonan pembukaan rekening.
          </p>
        )}
      </div>

      {/* Tabel Seluruh Rekening Aktif */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '14px' }}>💳 Seluruh Rekening Terdaftar ({accounts.length})</h3>

        {accounts.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--fg-muted)' }}>
                  <th style={{ padding: '8px 12px' }}>Nomor Rekening</th>
                  <th style={{ padding: '8px 12px' }}>Pemilik</th>
                  <th style={{ padding: '8px 12px' }}>Jenis</th>
                  <th style={{ padding: '8px 12px' }}>Saldo Pembukuan</th>
                  <th style={{ padding: '8px 12px' }}>Status</th>
                  <th style={{ padding: '8px 12px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr key={acc.id} style={{ borderBottom: '1px solid rgba(220, 230, 240, 0.05)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '800' }}>{acc.account_number}</td>
                    <td style={{ padding: '10px 12px' }}>{acc.profiles?.full_name || acc.profiles?.email || 'Member'}</td>
                    <td style={{ padding: '10px 12px' }}>{acc.account_type}</td>
                    <td style={{ padding: '10px 12px', fontWeight: '800', color: 'var(--accent2)' }}>
                      {formatRupiah(acc.book_balance)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`status ${acc.status === 'ACTIVE' ? 'good' : 'bad'}`}>
                        {acc.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${acc.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => handleToggleAccountStatus(acc)}
                      >
                        {acc.status === 'ACTIVE' ? 'Bekukan' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--fg-muted)', fontSize: '12px', textAlign: 'center', margin: '20px 0' }}>
            Belum ada rekening yang terbit.
          </p>
        )}
      </div>

      {/* Decision Modal */}
      {selectedApp && (
        <div className="member-portal-overlay">
          <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '16px' }}>
              Keputusan: {actionType === 'approve' ? 'Setujui Rekening' : actionType === 'reject' ? 'Tolak Rekening' : 'Minta Revisi'}
            </h3>
            <p style={{ color: 'var(--fg-muted)', fontSize: '12px', margin: '0 0 14px' }}>
              Pemohon: <b>{selectedApp.profiles?.full_name}</b> ({selectedApp.account_type})
            </p>

            {errorMsg && (
              <div style={{ padding: '8px 12px', background: 'rgba(231, 76, 60, 0.2)', color: '#ff8a80', fontSize: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                {errorMsg}
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
                className={`btn ${actionType === 'approve' ? 'btn-success' : actionType === 'reject' ? 'btn-danger' : 'btn-primary'}`}
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

