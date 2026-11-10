import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const { signIn, isSupabaseConfigured } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setErrorMsg('Harap isi email dan password.')
      return
    }

    setLoading(true)
    setErrorMsg('')

    const res = await signIn({ email, password })
    setLoading(false)

    if (!res.ok) {
      setErrorMsg(res.error || 'Login gagal. Periksa kembali email dan password Anda.')
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '800' }}>Masuk Akun Member</h3>
      <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--fg-muted)' }}>
        Akses rekening tabungan dan kotak fisik Anda
      </p>

      {!isSupabaseConfigured && (
        <div style={{
          padding: '12px 14px',
          borderRadius: '12px',
          background: 'rgba(52, 152, 219, 0.12)',
          border: '1px solid rgba(52, 152, 219, 0.25)',
          color: '#74c0e8',
          fontSize: '12px',
          lineHeight: '1.5',
        }}>
          <div style={{ marginBottom: '8px' }}>
            💡 <b>Mode Simulasi Instan:</b> Pilih akun uji coba di bawah ini untuk masuk langsung:
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              style={{ fontSize: '11px', padding: '4px 10px' }}
              onClick={() => {
                setEmail('admin@nvb.com')
                setPassword('admin123')
              }}
            >
              🛡️ Admin: admin@nvb.com
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              style={{ fontSize: '11px', padding: '4px 10px' }}
              onClick={() => {
                setEmail('member@nvb.com')
                setPassword('member123')
              }}
            >
              👤 Member: member@nvb.com
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '10px',
          background: 'rgba(231, 76, 60, 0.18)',
          color: '#ff8a80',
          fontSize: '12px',
          fontWeight: '700',
        }}>
          ⚠️ {errorMsg}
        </div>
      )}

      <div>
        <label className="form-label" htmlFor="email">Alamat Email</label>
        <input
          id="email"
          type="email"
          className="form-field"
          placeholder="nama@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="form-label" htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          className="form-field"
          placeholder="Masukkan password akun"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Link to="/reset-password" style={{ fontSize: '11px', color: 'var(--accent2)' }}>
          Lupa password?
        </Link>
      </div>

      <button type="submit" disabled={loading} className="btn btn-primary btn-full" style={{ marginTop: '6px' }}>
        {loading ? 'Memproses...' : 'Masuk Sekarang'}
      </button>

      <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: 'var(--fg-muted)' }}>
        Belum memiliki akun?{' '}
        <Link to="/register" style={{ color: 'var(--accent)', fontWeight: '700' }}>
          Daftar Member Baru
        </Link>
      </div>
    </form>
  )
}

