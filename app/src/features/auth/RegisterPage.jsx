import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { Button } from '../../components/ui'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const { signUp, isSupabaseConfigured } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fullName || !email || !password) {
      setErrorMsg('Mohon lengkapi seluruh kolom formulir.')
      return
    }

    if (password.length < 6) {
      setErrorMsg('Kata sandi minimal 6 karakter demi keamanan akun.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('Konfirmasi kata sandi tidak cocok.')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    const res = await signUp({ email, password, fullName })
    setLoading(false)

    if (!res.ok) {
      setErrorMsg(res.error || 'Pendaftaran gagal.')
    } else {
      setSuccessMsg('Registrasi berhasil! Mengalihkan ke dashboard tabungan...')
      setTimeout(() => navigate('/dashboard'), 1500)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>
          Pendaftaran Member Baru
        </h3>
        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)' }}>
          Buka rekening tabungan mandiri dan dapatkan fasilitas kotak tabungan fisik NFC
        </p>
      </div>

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
          💡 <b>Mode Demo Mandiri Aktif:</b> Anda dapat mendaftar dengan nama & email apa saja untuk mencoba seluruh fitur. Gunakan email dengan kata <code>admin</code> jika ingin menguji akun Administrator.
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

      {successMsg && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#65d69a',
            fontSize: '12.5px',
            fontWeight: '700',
          }}
        >
          ✅ {successMsg}
        </div>
      )}

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" htmlFor="regFullName">Nama Lengkap (Sesuai KTP)</label>
        <div className="input-with-icon">
          <span className="input-icon">👤</span>
          <input
            id="regFullName"
            type="text"
            className="form-field"
            placeholder="Contoh: Narendra Pratama"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" htmlFor="regEmail">Alamat Email</label>
        <div className="input-with-icon">
          <span className="input-icon">✉️</span>
          <input
            id="regEmail"
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
        <label className="form-label" htmlFor="regPassword">Buat Kata Sandi</label>
        <div className="input-with-icon">
          <span className="input-icon">🔒</span>
          <input
            id="regPassword"
            type="password"
            className="form-field"
            placeholder="Minimal 6 karakter"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" htmlFor="confirmPassword">Konfirmasi Kata Sandi</label>
        <div className="input-with-icon">
          <span className="input-icon">🔐</span>
          <input
            id="confirmPassword"
            type="password"
            className="form-field"
            placeholder="Ulangi kata sandi di atas"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        loading={loading}
        size="lg"
        style={{ width: '100%', marginTop: '8px' }}
      >
        Daftar Sebagai Member
      </Button>

      <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
        Sudah memiliki akun?{' '}
        <Link to="/login" style={{ color: 'var(--accent)', fontWeight: '700' }}>
          Masuk di Sini
        </Link>
      </div>
    </form>
  )
}
