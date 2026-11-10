import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'

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
      setErrorMsg('Mohon lengkapi seluruh formulir.')
      return
    }

    if (password.length < 6) {
      setErrorMsg('Password minimal 6 karakter demi keamanan akun.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok.')
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
      setSuccessMsg('Registrasi berhasil! Mengalihkan ke dashboard...')
      setTimeout(() => navigate('/dashboard'), 1500)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '800' }}>Pendaftaran Member Baru</h3>
      <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--fg-muted)' }}>
        Buka rekening mandiri dan dapatkan fasilitas kotak tabungan NFC fisik
      </p>

      {!isSupabaseConfigured && (
        <div style={{
          padding: '10px 12px',
          borderRadius: '10px',
          background: 'rgba(52, 152, 219, 0.15)',
          border: '1px solid rgba(52, 152, 219, 0.3)',
          color: '#74c0e8',
          fontSize: '11.5px',
          lineHeight: '1.5',
        }}>
          💡 <b>Mode Demo Mandiri Aktif:</b> Anda dapat langsung mendaftar dengan nama & email apa saja untuk mencoba seluruh fitur. Gunakan email yang mengandung kata <code>admin</code> (contoh: <code>admin@narayan.bank</code>) jika ingin menguji akun Administrator!
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(231, 76, 60, 0.18)', color: '#ff8a80', fontSize: '12px', fontWeight: '700' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {successMsg && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(46, 204, 113, 0.18)', color: '#65d69a', fontSize: '12px', fontWeight: '700' }}>
          ✅ {successMsg}
        </div>
      )}

      <div>
        <label className="form-label" htmlFor="fullName">Nama Lengkap (Sesuai KTP)</label>
        <input
          id="fullName"
          type="text"
          className="form-field"
          placeholder="Contoh: Narendra Pratama"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="form-label" htmlFor="regEmail">Alamat Email</label>
        <input
          id="regEmail"
          type="email"
          className="form-field"
          placeholder="nama@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="form-label" htmlFor="regPassword">Buat Password</label>
        <input
          id="regPassword"
          type="password"
          className="form-field"
          placeholder="Minimal 6 karakter"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="form-label" htmlFor="confirmPassword">Konfirmasi Password</label>
        <input
          id="confirmPassword"
          type="password"
          className="form-field"
          placeholder="Ulangi password di atas"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>

      <button type="submit" disabled={loading} className="btn btn-primary btn-full" style={{ marginTop: '6px' }}>
        {loading ? 'Mendaftarkan Akun...' : 'Daftar Sebagai Member'}
      </button>

      <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: 'var(--fg-muted)' }}>
        Sudah memiliki akun?{' '}
        <Link to="/login" style={{ color: 'var(--accent)', fontWeight: '700' }}>
          Masuk di Sini
        </Link>
      </div>
    </form>
  )
}

