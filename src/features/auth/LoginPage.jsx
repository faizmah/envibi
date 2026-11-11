import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { Button } from '../../components/ui'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const { signIn, isSupabaseConfigured, sessionNotice, clearSessionNotice } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setErrorMsg('Harap isi alamat email dan kata sandi.')
      return
    }

    setLoading(true)
    setErrorMsg('')
    clearSessionNotice?.()

    const res = await signIn({ email, password })
    setLoading(false)

    if (!res.ok) {
      setErrorMsg(res.error || 'Login gagal. Periksa kembali email dan password Anda.')
    } else {
      if (res.role === 'ADMIN' || res.role === 'SUPER_ADMIN') {
        navigate('/admin')
      } else {
        navigate('/dashboard')
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>
          Masuk Akun Member
        </h3>
        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)' }}>
          Akses rekening tabungan mandiri dan kotak pintar NFC Anda
        </p>
      </div>

      {sessionNotice && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: 'var(--warning, #f59e0b)',
            fontSize: '12.5px',
            fontWeight: '600',
            lineHeight: '1.5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span>⏳ {sessionNotice}</span>
          <button
            type="button"
            onClick={clearSessionNotice}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: '800',
              padding: '2px 6px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {!isSupabaseConfigured && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#93c5fd',
            fontSize: '12px',
            lineHeight: '1.5',
          }}
        >
          💡 <b>Mode Demo Mandiri Aktif:</b> Masuk dengan email & password apa saja. Gunakan email dengan kata <code>admin</code> untuk hak akses Administrator.
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ff8a80',
            fontSize: '12.5px',
            fontWeight: '700',
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" htmlFor="loginEmail">Alamat Email</label>
        <div className="input-with-icon">
          <span className="input-icon">✉️</span>
          <input
            id="loginEmail"
            type="email"
            className="form-field"
            placeholder="nama@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label className="form-label" htmlFor="loginPassword">Kata Sandi</label>
          <Link to="/reset-password" style={{ fontSize: '11px', color: 'var(--accent2)' }}>
            Lupa password?
          </Link>
        </div>
        <div className="input-with-icon">
          <span className="input-icon">🔒</span>
          <input
            id="loginPassword"
            type="password"
            className="form-field"
            placeholder="Masukkan kata sandi akun"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        loading={loading}
        size="lg"
        style={{ width: '100%', marginTop: '6px' }}
      >
        Masuk Sekarang
      </Button>

      <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
        Belum memiliki akun?{' '}
        <Link to="/register" style={{ color: 'var(--accent)', fontWeight: '700' }}>
          Daftar Member Baru
        </Link>
      </div>
    </form>
  )
}
