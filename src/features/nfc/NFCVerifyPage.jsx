import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../services/supabase/client'
import { readNFCTag, isNFCSupported } from '../../services/nfc/nfcService'
import { formatRupiah } from '../../utils/format'

export default function NFCVerifyPage() {
  const [tokenInput, setTokenInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [scanMsg, setScanMsg] = useState('')

  const handleVerify = async (tok) => {
    const t = tok || tokenInput
    if (!t.trim()) return

    setVerifying(true)
    setErrorMsg('')
    setResult(null)

    const { data, error } = await supabase.rpc('verify_nfc_token', {
      p_public_token: t.trim(),
    })

    setVerifying(false)

    if (error || !data?.ok) {
      setErrorMsg(error?.message || data?.error || 'Verifikasi gagal. Tag tidak valid.')
    } else {
      setResult(data)
    }
  }

  const handleScanAndVerify = async () => {
    setErrorMsg('')
    setResult(null)
    setScanMsg('Dekatkan perangkat ke tag NFC...')

    const scan = await readNFCTag((p) => setScanMsg(p.message))
    if (!scan.ok) {
      setErrorMsg(scan.error || 'Gagal membaca tag NFC.')
      return
    }

    setTokenInput(scan.token)
    setScanMsg('Tag terbaca! Memvalidasi ke server...')
    handleVerify(scan.token)
  }

  return (
    <div style={{ maxWidth: '640px', margin: '30px auto', padding: '0 20px' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <span style={{ fontSize: '11px', color: 'var(--accent2)', fontWeight: '800' }}>
              VERIFIKASI INTEGRITAS NFC
            </span>
            <h2 style={{ margin: '4px 0', fontSize: '20px', fontWeight: '800' }}>
              Uji & Periksa Tag NFC
            </h2>
          </div>
          <span className="status info">Alat Diagnostik</span>
        </div>

        <p style={{ color: 'var(--fg-muted)', fontSize: '12px', lineHeight: '1.6', margin: '0 0 16px' }}>
          Gunakan halaman ini untuk memverifikasi apakah tag NFC pada kotak tabungan fisik telah terdaftar, aktif, dan terhubung ke rekening yang sesuai.
        </p>

        {scanMsg && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(52, 152, 219, 0.15)', color: '#74c0e8', fontSize: '12px', fontWeight: '700', marginBottom: '14px' }}>
            ℹ️ {scanMsg}
          </div>
        )}

        {errorMsg && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(231, 76, 60, 0.18)', color: '#ff8a80', fontSize: '12px', fontWeight: '700', marginBottom: '14px' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Scan Button */}
        {isNFCSupported() && (
          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={handleScanAndVerify}
            disabled={verifying}
            style={{ marginBottom: '16px' }}
          >
            📡 Tempelkan & Verifikasi Tag Sekarang
          </button>
        )}

        {/* Manual Token Verification */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <input
            type="text"
            className="form-field"
            placeholder="Masukkan token public NFC..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            style={{ margin: 0 }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleVerify()}
            disabled={verifying || !tokenInput}
          >
            {verifying ? 'Memeriksa...' : 'Verifikasi'}
          </button>
        </div>

        {/* Result Card */}
        {result && (
          <div style={{
            background: 'rgba(46, 204, 113, 0.12)',
            border: '1px solid rgba(46, 204, 113, 0.3)',
            borderRadius: '12px',
            padding: '16px',
            fontSize: '13px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#65d69a', fontWeight: '800' }}>
              <span>✅ Tag NFC Terverifikasi & Sah</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'var(--fg-muted)', display: 'block' }}>Kode Kotak:</span>
                <b>{result.box_code}</b>
              </div>
              <div>
                <span style={{ color: 'var(--fg-muted)', display: 'block' }}>Nomor Rekening:</span>
                <b>{result.account_number}</b>
              </div>
              <div>
                <span style={{ color: 'var(--fg-muted)', display: 'block' }}>Saldo Pembukuan:</span>
                <b style={{ color: 'var(--accent2)' }}>{formatRupiah(result.book_balance)}</b>
              </div>
              <div>
                <span style={{ color: 'var(--fg-muted)', display: 'block' }}>Status Hubungan:</span>
                <span className="status good">Aktif</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

