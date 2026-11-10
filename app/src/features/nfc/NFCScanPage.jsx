import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { readNFCTag, getNFCStatus } from '../../services/nfc/nfcService'

export default function NFCScanPage() {
  const navigate = useNavigate()
  const [scanning, setScanning] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [manualToken, setManualToken] = useState('')

  const nfcSupport = getNFCStatus()

  const handleStartScan = async () => {
    setErrorMsg('')
    setScanning(true)
    setMessage('Dekatkan perangkat Anda ke tag NFC pada kotak tabungan...')

    const res = await readNFCTag((p) => setMessage(p.message))
    setScanning(false)

    if (!res.ok) {
      setErrorMsg(res.error || 'Gagal membaca tag NFC.')
    } else {
      navigate(`/nfc/${res.token}`)
    }
  }

  const handleManualSubmit = (e) => {
    e.preventDefault()
    if (!manualToken.trim()) return
    navigate(`/nfc/${manualToken.trim()}`)
  }

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
      <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
        <div style={{ fontSize: '50px', marginBottom: '14px' }}>📡</div>
        <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: '800' }}>Pemindai NFC Kotak Tabungan</h2>
        <p style={{ color: 'var(--fg-muted)', fontSize: '12px', maxWidth: '440px', margin: '0 auto 24px', lineHeight: '1.6' }}>
          Gunakan perangkat yang memiliki fitur NFC untuk membaca identitas kotak tabungan mandiri Anda.
        </p>

        {nfcSupport.supported ? (
          <div className="nfc-status-indicator supported" style={{ marginBottom: '20px', textAlign: 'left' }}>
            ✅ Perangkat siap membaca tag NFC melalui Web NFC API.
          </div>
        ) : (
          <div className="nfc-status-indicator unsupported" style={{ marginBottom: '20px', textAlign: 'left' }}>
            <div>
              <b>⚠️ Web NFC API Tidak Tersedia</b>
              <p style={{ margin: '4px 0 0', fontSize: '11px', opacity: 0.9 }}>
                Web NFC memerlukan Google Chrome di Android via HTTPS. Anda tetap dapat memasukkan token kotak secara manual.
              </p>
            </div>
          </div>
        )}

        {message && (
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(52, 152, 219, 0.15)', color: '#74c0e8', fontSize: '12px', fontWeight: '700', marginBottom: '16px' }}>
            {message}
          </div>
        )}

        {errorMsg && (
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(231, 76, 60, 0.18)', color: '#ff8a80', fontSize: '12px', fontWeight: '700', marginBottom: '16px' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {nfcSupport.supported && (
          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={handleStartScan}
            disabled={scanning}
            style={{ padding: '14px', fontSize: '14px', marginBottom: '20px' }}
          >
            {scanning ? '⏳ Mendengarkan Tag...' : '📡 Mulai Pemindaian NFC'}
          </button>
        )}

        {/* Input Manual Token */}
        <form onSubmit={handleManualSubmit} style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '10px' }}>
          <label className="form-label">Atau Masukkan Token Kotak Tabungan Manual</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <input
              type="text"
              className="form-field"
              placeholder="Masukkan public token kotak..."
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              style={{ margin: 0 }}
            />
            <button type="submit" className="btn btn-secondary">
              Buka
            </button>
          </div>
        </form>

        <div style={{ marginTop: '24px' }}>
          <Link to="/dashboard" style={{ fontSize: '12px', color: 'var(--accent2)' }}>
            ← Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

