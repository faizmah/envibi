import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { supabase } from '../../services/supabase/client'
import { formatRupiah, formatDateTime } from '../../utils/format'

export default function PhysicalBalancePage() {
  const { user } = useAuth()

  const [account, setAccount] = useState(null)
  const [box, setBox] = useState(null)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  // Report form
  const [reportedBalance, setReportedBalance] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const loadData = async () => {
    if (!user) return
    setLoading(true)

    // Ambil rekening aktif
    const { data: accs } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .limit(1)

    if (accs && accs.length > 0) {
      const a = accs[0]
      setAccount(a)

      // Ambil kotak
      const { data: b } = await supabase
        .from('savings_boxes')
        .select('*')
        .eq('account_id', a.id)
        .single()
      setBox(b || null)

      // Ambil riwayat laporan rekonsiliasi
      const { data: rep } = await supabase
        .from('physical_balance_reports')
        .select('*')
        .eq('account_id', a.id)
        .order('created_at', { ascending: false })

      setReports(rep || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [user])

  const bookBalance = Number(account?.book_balance || 0)
  const currentReported = reportedBalance !== '' ? Number(reportedBalance) : 0
  const previewDiff = currentReported - bookBalance

  const handleSubmitReport = async (e) => {
    e.preventDefault()
    if (!account) return

    if (reportedBalance === '' || Number(reportedBalance) < 0) {
      setErrorMsg('Masukkan nominal saldo fisik yang valid.')
      return
    }

    setSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    const { error } = await supabase.from('physical_balance_reports').insert({
      account_id: account.id,
      box_id: box?.id || null,
      user_id: user.id,
      reported_balance: Number(reportedBalance),
      book_balance_snapshot: bookBalance,
      status: previewDiff === 0 ? 'ACKNOWLEDGED' : 'REPORTED',
      notes: notes.trim() || null,
    })

    setSubmitting(false)

    if (error) {
      setErrorMsg('Gagal mengirim laporan: ' + error.message)
    } else {
      setSuccessMsg(
        previewDiff === 0
          ? 'Laporan saldo fisik cocok dengan pembukuan (Rp 0 selisih)!'
          : 'Laporan rekonsiliasi tersimpan. Terdapat selisih yang dicatat untuk pemeriksaan.'
      )
      setReportedBalance('')
      setNotes('')
      loadData()
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--fg-muted)' }}>Memuat rekonsiliasi saldo...</p>
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

  const latestReport = reports[0] || null
  const lastDiff = latestReport ? Number(latestReport.difference_amount || 0) : null

  return (
    <div style={{ maxWidth: '800px', margin: '20px auto 60px', padding: '0 20px' }}>
      {/* Top Banner Overview */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div>
            <span style={{ fontSize: '11px', color: 'var(--accent2)', fontWeight: '800' }}>
              REKONSILIASI KOTAK FISIK DI RUMAH
            </span>
            <h2 style={{ margin: '4px 0', fontSize: '22px', fontWeight: '800' }}>
              Pencocokan Saldo Tabungan Mandiri
            </h2>
          </div>
          <span className={`status ${lastDiff === 0 ? 'good' : lastDiff !== null ? 'wait' : ''}`}>
            {lastDiff === 0 ? 'SESUAI' : lastDiff !== null ? 'PERLU PEMERIKSAAN' : 'BELUM LAPOR'}
          </span>
        </div>

        <p style={{ color: 'var(--fg-muted)', fontSize: '12px', lineHeight: '1.6', margin: '0 0 20px' }}>
          Karena uang fisik Anda disimpan sendiri di rumah, sistem menyediakan fitur rekonsiliasi rutin. Hitung uang fisik di dalam kotak Anda dan laporkan untuk membandingkannya dengan saldo pembukuan digital.
        </p>

        {/* Comparison KPI Grid */}
        <div className="kpi-grid" style={{ marginBottom: '14px' }}>
          <div className="kpi-item" style={{ borderLeft: '4px solid var(--accent)' }}>
            <span className="kpi-label">Saldo Pembukuan Sistem</span>
            <b className="kpi-value" style={{ color: 'var(--accent2)' }}>{formatRupiah(bookBalance)}</b>
            <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Angka digital bank</small>
          </div>

          <div className="kpi-item" style={{ borderLeft: '4px solid #3498db' }}>
            <span className="kpi-label">Saldo Fisik Terakhir Dilaporkan</span>
            <b className="kpi-value">
              {latestReport ? formatRupiah(latestReport.reported_balance) : 'Belum Lapor'}
            </b>
            <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>
              {latestReport ? formatDateTime(latestReport.created_at) : '-'}
            </small>
          </div>

          <div className="kpi-item" style={{ borderLeft: lastDiff === 0 ? '4px solid #2ecc71' : '4px solid #f39c12' }}>
            <span className="kpi-label">Selisih Terakhir</span>
            <b className="kpi-value" style={{ color: lastDiff === 0 ? '#65d69a' : '#f39c12' }}>
              {lastDiff !== null ? (lastDiff === 0 ? 'Sesuai (Rp 0)' : formatRupiah(lastDiff)) : '-'}
            </b>
            <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>
              {lastDiff === 0 ? '✅ Pembukuan seimbang' : 'Ada perbedaan angka'}
            </small>
          </div>
        </div>
      </div>

      {/* Form Lapor Saldo Fisik */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 className="card-title" style={{ marginBottom: '14px' }}>📝 Laporkan Saldo Fisik Saat Ini</h3>

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

        <form onSubmit={handleSubmitReport} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="form-label">Total Uang Tunai di Kotak Fisik Saat Ini (Rp)</label>
            <input
              type="number"
              className="form-field"
              placeholder="Contoh: 500000"
              value={reportedBalance}
              onChange={(e) => setReportedBalance(e.target.value)}
              min="0"
              step="1000"
              required
              style={{ fontSize: '18px', fontWeight: '800' }}
            />
            {reportedBalance !== '' && (
              <div style={{
                marginTop: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                background: previewDiff === 0 ? 'rgba(46, 204, 113, 0.12)' : 'rgba(243, 156, 18, 0.12)',
                color: previewDiff === 0 ? '#65d69a' : '#f39c12',
              }}>
                <b>Hasil Perhitungan:</b> Selisih = {previewDiff === 0 ? 'Rp 0 (Sesuai)' : formatRupiah(previewDiff)}
                {previewDiff !== 0 && (
                  <span style={{ display: 'block', fontSize: '11px', marginTop: '4px', color: 'var(--fg-muted)' }}>
                    *Sistem tidak akan otomatis mengubah saldo pembukuan untuk menyamakan saldo fisik. Perbedaan akan dicatat dalam laporan audit.
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="form-label">Catatan / Klarifikasi (Jika Ada Selisih)</label>
            <textarea
              className="form-field"
              rows="2"
              placeholder="Contoh: Ada pecahan Rp 50.000 yang belum sempat dilaporkan setoran"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Menyimpan Laporan...' : 'Kirim Laporan Rekonsiliasi'}
            </button>
          </div>
        </form>
      </div>

      {/* Riwayat Laporan Rekonsiliasi */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '14px' }}>Riwayat Laporan Rekonsiliasi</h3>

        {reports.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {reports.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span>Waktu: <b>{formatDateTime(r.created_at)}</b></span>
                  <span className={`status ${Number(r.difference_amount) === 0 ? 'good' : 'wait'}`}>
                    {Number(r.difference_amount) === 0 ? 'Sesuai' : 'Ada Selisih'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', color: 'var(--fg-muted)' }}>
                  <span>Fisik Dilaporkan: <b style={{ color: '#edf2f7' }}>{formatRupiah(r.reported_balance)}</b></span>
                  <span>Snapshot Buku: <b style={{ color: '#edf2f7' }}>{formatRupiah(r.book_balance_snapshot)}</b></span>
                  <span>Selisih: <b style={{ color: Number(r.difference_amount) === 0 ? '#65d69a' : '#f39c12' }}>{formatRupiah(r.difference_amount)}</b></span>
                </div>
                {r.notes && (
                  <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--fg-muted)' }}>
                    Catatan: {r.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--fg-muted)', fontSize: '12px', textAlign: 'center', margin: '20px 0' }}>
            Belum ada catatan rekonsiliasi fisik. Lakukan laporan di atas untuk mencocokkan saldo Anda.
          </p>
        )}
      </div>
    </div>
  )
}

