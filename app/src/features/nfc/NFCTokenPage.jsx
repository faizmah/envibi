import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { supabase } from '../../services/supabase/client'
import { formatRupiah } from '../../utils/format'

export default function NFCTokenPage() {
  const { token } = useParams()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [verifying, setVerifying] = useState(true)
  const [boxData, setBoxData] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setErrorMsg('Token NFC tidak ditemukan.')
        setVerifying(false)
        return
      }

      if (authLoading) return

      if (!user) {
        // Simpan token di session storage agar setelah login bisa kembali
        sessionStorage.setItem('pending_nfc_token', token)
        navigate('/login?redirect=/nfc/' + token)
        return
      }

      // Verifikasi token via backend RPC
      const { data, error } = await supabase.rpc('verify_nfc_token', {
        p_public_token: token,
      })

      setVerifying(false)

      if (error || !data?.ok) {
        setErrorMsg(error?.message || data?.error || 'Token NFC tidak valid atau bukan milik akun Anda.')
      } else {
        setBoxData(data)
      }
    }

    verifyToken()
  }, [token, user, authLoading, navigate])

  if (authLoading || verifying) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: '#edf2f7' }}>
        <div className="loading-spinner" style={{ marginBottom: '16px' }} />
        <h3 style={{ margin: '0 0 6px', fontWeight: '800' }}>Memindai Tag Kotak NFC...</h3>
        <p style={{ color: 'var(--fg-muted)', fontSize: '13px' }}>Memverifikasi identitas kotak dengan backend bank</p>
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'var(--bg)' }}>
        <div className="card" style={{ maxWidth: '440px', width: '100%', textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '14px' }}>⚠️</div>
          <h3 style={{ margin: '0 0 8px', color: '#ff8a80' }}>Verifikasi NFC Gagal</h3>
          <p style={{ color: 'var(--fg-muted)', fontSize: '13px', lineHeight: '1.6', marginBottom: '24px' }}>
            {errorMsg}
          </p>
          <Link to="/dashboard" className="btn btn-secondary btn-full">
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'var(--bg)' }}>
      <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '32px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '50px', marginBottom: '10px' }}>📦</div>
          <span style={{ fontSize: '11px', color: 'var(--accent2)', fontWeight: '800', textTransform: 'uppercase' }}>
            KOTAK TABUNGAN TERVERIFIKASI
          </span>
          <h2 style={{ margin: '4px 0 6px', fontSize: '22px', fontWeight: '800' }}>
            {boxData?.box_code}
          </h2>
          <p style={{ color: 'var(--fg-muted)', fontSize: '12px', margin: 0 }}>
            Nomor Rekening: <b>{boxData?.account_number}</b>
          </p>
          <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--accent2)', marginTop: '10px' }}>
            {formatRupiah(boxData?.book_balance)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Link to="/deposit" className="btn btn-primary btn-full" style={{ padding: '14px', fontSize: '14px' }}>
            📥 Lapor Setoran ke Kotak Ini
          </Link>
          <Link to="/withdrawal" className="btn btn-secondary btn-full" style={{ padding: '14px', fontSize: '14px' }}>
            📤 Lapor Penarikan dari Kotak Ini
          </Link>
          <Link to="/physical-balance" className="btn btn-secondary btn-full">
            ⚖️ Cocokkan Saldo Fisik Kotak
          </Link>
          <Link to="/dashboard" className="btn btn-secondary btn-full" style={{ marginTop: '8px' }}>
            📊 Buka Dashboard Pribadi
          </Link>
        </div>
      </div>
    </div>
  )
}

