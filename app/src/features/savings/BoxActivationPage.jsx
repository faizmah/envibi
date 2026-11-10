import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { supabase } from '../../services/supabase/client'
import { readNFCTag, isNFCSupported, getNFCStatus } from '../../services/nfc/nfcService'
import { formatBoxStatus, formatDateTime } from '../../utils/format'

export default function BoxActivationPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [box, setBox] = useState(null)
  const [shipment, setShipment] = useState(null)
  const [loading, setLoading] = useState(true)

  const [scanStatus, setScanStatus] = useState('idle') // idle, scanning, scanned, activating, success, error
  const [statusMessage, setStatusMessage] = useState('')
  const [scannedToken, setScannedToken] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const nfcSupport = getNFCStatus()

  useEffect(() => {
    async function loadBox() {
      if (!user) return
      setLoading(true)

      // Cari kotak tabungan milik member
      const { data: boxes } = await supabase
        .from('savings_boxes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (boxes && boxes.length > 0) {
        const b = boxes[0]
        setBox(b)

        // Cari data resi pengiriman
        const { data: ship } = await supabase
          .from('shipments')
          .select('*')
          .eq('box_id', b.id)
          .single()

        setShipment(ship || null)
      }

      setLoading(false)
    }

    loadBox()
  }, [user])

  // Scan NFC Handler
  const handleScanNFC = async () => {
    setErrorMessage('')
    setScanStatus('scanning')
    setStatusMessage('Dekatkan perangkat Anda ke tag NFC pada kotak tabungan fisik...')

    const result = await readNFCTag((progress) => {
      setStatusMessage(progress.message)
    })

    if (!result.ok) {
      setScanStatus('error')
      setErrorMessage(result.error || 'Gagal membaca tag NFC.')
      return
    }

    setScannedToken(result.token)
    setScanStatus('scanned')
    setStatusMessage('Tag NFC terbaca! Konfirmasikan aktivasi kotak tabungan Anda.')
  }

  // Confirm Activation
  const handleConfirmActivation = async () => {
    if (!box || !scannedToken) return

    setScanStatus('activating')
    setStatusMessage('Menghubungi server untuk memvalidasi dan mengaktifkan kotak...')

    const { data, error } = await supabase.rpc('activate_savings_box', {
      p_box_id: box.id,
      p_nfc_token: scannedToken,
    })

    if (error || !data?.ok) {
      setScanStatus('error')
      setErrorMessage(error?.message || data?.error || 'Aktivasi gagal. Pastikan tag ini terdaftar atas nama Anda.')
      return
    }

    setScanStatus('success')
    setStatusMessage('Selamat! Kotak tabungan fisik Anda telah AKTIF dan siap digunakan untuk setor/tarik mandiri.')
    setBox((prev) => ({ ...prev, status: 'ACTIVE', activated_at: new Date().toISOString() }))
  }

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--fg-muted)' }}>Memuat status kotak tabungan...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '760px', margin: '20px auto 60px', padding: '0 20px' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <span style={{ fontSize: '11px', color: 'var(--accent2)', fontWeight: '800' }}>
              AKTIVASI KOTAK FISIK
            </span>
            <h2 style={{ margin: '4px 0', fontSize: '22px', fontWeight: '800' }}>
              Konfirmasi & Aktivasi Kotak Tabungan
            </h2>
            <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: '12px' }}>
              Tautkan kotak tabungan fisik di rumah Anda dengan memindai tag NFC
            </p>
          </div>
          <span className={`status ${box?.status === 'ACTIVE' ? 'good' : 'wait'}`}>
            {formatBoxStatus(box?.status || 'PREPARING')}
          </span>
        </div>

        {/* Box & Shipment Info */}
        {box ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            marginBottom: '20px',
            fontSize: '12px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
          }}>
            <div>
              <span style={{ color: 'var(--fg-muted)', display: 'block' }}>Kode Kotak</span>
              <b style={{ fontSize: '14px' }}>{box.box_code}</b>
            </div>
            <div>
              <span style={{ color: 'var(--fg-muted)', display: 'block' }}>Status Pengiriman</span>
              <b>{shipment ? `${shipment.courier || 'Kurir'} · No. Resi: ${shipment.tracking_number || '-'}` : 'Sedang disiapkan'}</b>
            </div>
            <div>
              <span style={{ color: 'var(--fg-muted)', display: 'block' }}>Waktu Disiapkan</span>
              <span>{formatDateTime(box.created_at)}</span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--fg-muted)' }}>
            Belum ada kotak tabungan yang disiapkan. Pastikan Anda sudah mengajukan pembukaan rekening.
          </div>
        )}

        {/* NFC Capability Alert */}
        <div style={{ marginBottom: '20px' }}>
          {nfcSupport.supported ? (
            <div className="nfc-status-indicator supported">
              📡 Perangkat Anda mendukung Web NFC API (Siap Membaca Tag)
            </div>
          ) : (
            <div className="nfc-status-indicator unsupported">
              <div>
                <b>⚠️ Web NFC API tidak terdeteksi langsung</b>
                <p style={{ margin: '4px 0 0', fontSize: '11px', opacity: 0.9 }}>
                  Gunakan browser Google Chrome di Android dengan koneksi HTTPS, atau masukkan token kotak secara manual di bawah.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Status Messages */}
        {statusMessage && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: scanStatus === 'success' ? 'rgba(46, 204, 113, 0.15)' : 'rgba(52, 152, 219, 0.15)',
            color: scanStatus === 'success' ? '#65d69a' : '#74c0e8',
            fontSize: '12px',
            fontWeight: '700',
            marginBottom: '16px',
          }}>
            ℹ️ {statusMessage}
          </div>
        )}

        {errorMessage && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(231, 76, 60, 0.18)',
            color: '#ff8a80',
            fontSize: '12px',
            fontWeight: '700',
            marginBottom: '16px',
          }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Activation Actions */}
        {box?.status === 'ACTIVE' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎉</div>
            <h3 style={{ margin: '0 0 6px', color: '#65d69a' }}>Kotak Tabungan Sudah Aktif!</h3>
            <p style={{ color: 'var(--fg-muted)', fontSize: '12px', marginBottom: '16px' }}>
              Anda dapat langsung menggunakan kotak ini untuk menyetorkan atau menarik tabungan secara mandiri.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <Link to="/deposit" className="btn btn-primary">📥 Lapor Setoran</Link>
              <Link to="/dashboard" className="btn btn-secondary">Kembali ke Dashboard</Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {nfcSupport.supported ? (
              <button
                type="button"
                className="btn btn-primary btn-full"
                onClick={handleScanNFC}
                disabled={scanStatus === 'scanning' || scanStatus === 'activating'}
                style={{ padding: '14px', fontSize: '14px' }}
              >
                {scanStatus === 'scanning' ? '⏳ Mendengarkan Tag NFC...' : '📡 Pindai (Scan) Tag NFC Kotak'}
              </button>
            ) : null}

            {/* Manual fallback input token jika Web NFC tidak aktif di browser */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px dashed var(--border)' }}>
              <label className="form-label">
                Alternatif: Masukkan Token NFC / Tautan yang tertera pada kotak
              </label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <input
                  type="text"
                  className="form-field"
                  placeholder="Contoh: a1b2c3d4e5f6..."
                  value={scannedToken}
                  onChange={(e) => setScannedToken(e.target.value.trim())}
                  style={{ margin: 0 }}
                />
              </div>
              <small style={{ color: 'var(--fg-muted)', fontSize: '11px', display: 'block', marginTop: '6px' }}>
                Token identifikasi fisik tertera pada label verifikasi di bagian bawah kotak tabungan.
              </small>
            </div>

            {scannedToken && (
              <button
                type="button"
                className="btn btn-success btn-full"
                onClick={handleConfirmActivation}
                disabled={scanStatus === 'activating'}
                style={{ padding: '14px', fontSize: '14px' }}
              >
                {scanStatus === 'activating' ? 'Mengaktifkan Kotak...' : '✅ Konfirmasi Penerimaan & Aktifkan Kotak'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

