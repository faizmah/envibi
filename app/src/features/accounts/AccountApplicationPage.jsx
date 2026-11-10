import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { supabase } from '../../services/supabase/client'
import { subscribeToApplications } from '../../services/realtime/realtimeService'
import { formatRupiah, formatDateTime } from '../../utils/format'

export default function AccountApplicationPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [accountType, setAccountType] = useState('TABUNGAN')
  const [initialDeposit, setInitialDeposit] = useState(50000)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  const loadApplications = async () => {
    if (!user) return
    const { data } = await supabase
      .from('account_applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (data) setApplications(data)
    setLoading(false)
  }

  useEffect(() => {
    loadApplications()
    const unsub = subscribeToApplications(user?.id, () => loadApplications())
    return () => unsub?.()
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user) return

    setSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    const { error: err } = await supabase.from('account_applications').insert({
      user_id: user.id,
      account_type: accountType,
      initial_deposit: Number(initialDeposit) || 0,
      notes: notes.trim() || null,
      status: 'PENDING',
    })

    setSubmitting(false)

    if (err) {
      setErrorMsg('Gagal mengirim pengajuan: ' + err.message)
    } else {
      setSuccessMsg('Pengajuan pembukaan rekening berhasil dikirim! Admin akan segera memeriksa berkas Anda.')
      setNotes('')
      loadApplications()
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '20px auto 60px', padding: '0 20px' }}>
      {/* Form Pengajuan Baru */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div className="card-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>Formulir Pembukaan Rekening</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: '12px' }}>
              Ajukan rekening mandiri untuk mendapatkan kotak tabungan fisik ber-NFC
            </p>
          </div>
          <span className="status good">Layanan Resmi</span>
        </div>

        {errorMsg && (
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(231, 76, 60, 0.18)', color: '#ff8a80', fontSize: '12px', fontWeight: '700', marginBottom: '14px' }}>
            ⚠️ {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(46, 204, 113, 0.18)', color: '#65d69a', fontSize: '12px', fontWeight: '700', marginBottom: '14px' }}>
            ✅ {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="form-label">Jenis Rekening</label>
            <select
              className="form-field"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
            >
              <option value="TABUNGAN">Tabungan Mandiri (Fasilitas Kotak NFC)</option>
              <option value="REGULER">Rekening Reguler</option>
              <option value="BISNIS">Rekening Tabungan Bisnis</option>
            </select>
            <small style={{ color: 'var(--fg-muted)', fontSize: '11px' }}>
              Pilih 'Tabungan Mandiri' untuk mendapatkan fasilitas kotak tabungan fisik yang dikirim ke rumah.
            </small>
          </div>

          <div>
            <label className="form-label">Rencana Setoran Awal (Rp)</label>
            <input
              type="number"
              className="form-field"
              value={initialDeposit}
              onChange={(e) => setInitialDeposit(Number(e.target.value))}
              min="0"
              step="10000"
              required
            />
            <small style={{ color: 'var(--fg-muted)', fontSize: '11px' }}>
              Setoran awal dapat berupa 0 atau dimasukkan langsung ke kotak saat kotak diterima.
            </small>
          </div>

          <div>
            <label className="form-label">Tujuan Tabungan / Catatan (Opsional)</label>
            <textarea
              className="form-field"
              rows="3"
              placeholder="Contoh: Tabungan dana darurat keluarga / Tabungan rencana masa depan"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Link to="/dashboard" className="btn btn-secondary">
              Batal
            </Link>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Rekening'}
            </button>
          </div>
        </form>
      </div>

      {/* Riwayat Pengajuan Rekening */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '16px' }}>Status Pengajuan Anda</h3>

        {applications.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {applications.map((app) => (
              <div
                key={app.id}
                style={{
                  padding: '14px 16px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <b>Pengajuan {app.account_type}</b>
                  <span className={`status ${
                    app.status === 'APPROVED' ? 'good' :
                    app.status === 'REJECTED' ? 'bad' :
                    app.status === 'REVISION_REQUIRED' ? 'bad' : 'wait'
                  }`}>
                    {app.status}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--fg-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span>Waktu Pengajuan: {formatDateTime(app.created_at)}</span>
                  <span>Rencana Setoran Awal: {formatRupiah(app.initial_deposit)}</span>
                  {app.admin_notes && (
                    <div style={{ marginTop: '6px', padding: '8px 12px', background: 'rgba(231, 76, 60, 0.1)', borderRadius: '8px', color: '#ff8a80' }}>
                      Catatan Admin: {app.admin_notes}
                    </div>
                  )}
                  {app.status === 'APPROVED' && (
                    <div style={{ marginTop: '8px' }}>
                      <Link to="/dashboard" className="btn btn-sm btn-primary">
                        Buka Dashboard Rekening →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--fg-muted)', fontSize: '13px', textAlign: 'center', margin: '20px 0' }}>
            Belum ada riwayat pengajuan rekening.
          </p>
        )}
      </div>
    </div>
  )
}

