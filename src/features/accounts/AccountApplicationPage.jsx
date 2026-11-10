import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { supabase } from '../../services/supabase/client'
import { subscribeToApplications } from '../../services/realtime/realtimeService'
import { formatRupiah, formatDateTime } from '../../utils/format'
import { Card, Button, Badge, SkeletonTable } from '../../components/ui'

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
      setSuccessMsg('Pengajuan pembukaan rekening berhasil dikirim! Admin Bank akan segera memverifikasi berkas Anda.')
      setNotes('')
      loadApplications()
    }
  }

  return (
    <div style={{ maxWidth: '840px', margin: '20px auto 80px', padding: '0 clamp(16px, 3vw, 24px)' }}>
      {/* ─── Form Pengajuan Baru ─── */}
      <Card
        variant="elevated"
        style={{ marginBottom: '28px' }}
        title="Formulir Pembukaan Rekening"
        subtitle="Ajukan rekening mandiri untuk mendapatkan fasilitas kotak tabungan fisik ber-NFC"
        action={<Badge variant="success" dot>Layanan Resmi NVB</Badge>}
      >
        {errorMsg && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ff8a80',
              fontSize: '13px',
              fontWeight: '700',
              marginBottom: '16px',
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}
        {successMsg && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#65d69a',
              fontSize: '13px',
              fontWeight: '700',
              marginBottom: '16px',
            }}
          >
            ✅ {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="form-label" htmlFor="accountTypeSelect">Jenis Rekening</label>
            <select
              id="accountTypeSelect"
              className="form-field"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
            >
              <option value="TABUNGAN">Tabungan Mandiri (Fasilitas Kotak Fisik NFC)</option>
              <option value="REGULER">Rekening Reguler</option>
              <option value="BISNIS">Rekening Tabungan Bisnis</option>
            </select>
            <small style={{ color: 'var(--text-muted)', fontSize: '11.5px', marginTop: '2px', display: 'block' }}>
              Pilih <b>Tabungan Mandiri</b> untuk mendapatkan fasilitas kotak tabungan fisik pintar yang dikirimkan ke alamat Anda.
            </small>
          </div>

          <div>
            <label className="form-label" htmlFor="depositInput">Rencana Setoran Awal (Rp)</label>
            <input
              id="depositInput"
              type="number"
              className="form-field"
              value={initialDeposit}
              onChange={(e) => setInitialDeposit(Number(e.target.value))}
              min="0"
              step="10000"
              required
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '11.5px', marginTop: '2px', display: 'block' }}>
              Setoran awal dapat dimulai dari Rp 0 atau dimasukkan langsung ke kotak fisik saat kotak telah diterima.
            </small>
          </div>

          <div>
            <label className="form-label" htmlFor="notesTextarea">Tujuan Tabungan / Catatan (Opsional)</label>
            <textarea
              id="notesTextarea"
              className="form-field"
              rows="3"
              placeholder="Contoh: Tabungan dana darurat keluarga / Rencana tabungan masa depan"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <Link to="/dashboard">
              <Button variant="secondary">Batal</Button>
            </Link>
            <Button type="submit" variant="primary" loading={submitting} icon="📝">
              Kirim Pengajuan Rekening
            </Button>
          </div>
        </form>
      </Card>

      {/* ─── Riwayat Pengajuan Rekening ─── */}
      <Card
        variant="surface"
        title="Status & Riwayat Pengajuan Rekening"
        subtitle="Pantau proses review dari admin bank hingga penerbitan nomor rekening resmi"
      >
        {loading ? (
          <SkeletonTable rows={3} />
        ) : applications.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
            {applications.map((app) => {
              const statusVariant =
                app.status === 'APPROVED' ? 'success' :
                app.status === 'REJECTED' ? 'danger' :
                app.status === 'REVISION_REQUIRED' ? 'warning' : 'info'

              return (
                <div
                  key={app.id}
                  style={{
                    padding: '16px 20px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '14px',
                    border: '1px solid var(--border)',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontWeight: '800', fontSize: '15px', color: 'var(--text-primary)' }}>
                      Pengajuan Rekening {app.account_type}
                    </span>
                    <Badge variant={statusVariant} dot>
                      {app.status}
                    </Badge>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span>Waktu Pengajuan: <b style={{ color: 'var(--text-primary)' }}>{formatDateTime(app.created_at)}</b></span>
                    <span>Rencana Setoran Awal: <b style={{ color: 'var(--accent2)' }}>{formatRupiah(app.initial_deposit)}</b></span>
                    {app.notes && (
                      <span style={{ color: 'var(--text-muted)' }}>Catatan Anda: &quot;{app.notes}&quot;</span>
                    )}
                    {app.admin_notes && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '10px 14px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: '10px',
                          color: '#ff8a80',
                          fontSize: '12px',
                        }}
                      >
                        <b>Catatan Admin:</b> {app.admin_notes}
                      </div>
                    )}
                    {app.status === 'APPROVED' && (
                      <div style={{ marginTop: '12px' }}>
                        <Link to="/dashboard">
                          <Button variant="primary" size="sm" icon="📊">
                            Buka Dashboard Rekening Aktif →
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>📝</span>
            <p style={{ margin: 0, fontSize: '13px' }}>Belum ada riwayat pengajuan rekening.</p>
          </div>
        )}
      </Card>
    </div>
  )
}
