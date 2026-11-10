import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../services/supabase/client'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleReset = async (e) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    setError('')
    setMessage('')

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setMessage('Instruksi pemulihan kata sandi telah dikirim ke email Anda.')
    }
  }

  return (
    <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '800' }}>Reset Password</h3>
      <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--fg-muted)' }}>
        Masukkan alamat email yang terdaftar untuk menerima tautan pemulihan kata sandi.
      </p>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(231, 76, 60, 0.18)', color: '#ff8a80', fontSize: '12px', fontWeight: '700' }}>
          ⚠️ {error}
        </div>
      )}

      {message && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(46, 204, 113, 0.18)', color: '#65d69a', fontSize: '12px', fontWeight: '700' }}>
          ✅ {message}
        </div>
      )}

      <div>
        <label className="form-label" htmlFor="resetEmail">Email Terdaftar</label>
        <input
          id="resetEmail"
          type="email"
          className="form-field"
          placeholder="nama@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <button type="submit" disabled={loading} className="btn btn-primary btn-full" style={{ marginTop: '6px' }}>
        {loading ? 'Mengirim...' : 'Kirim Tautan Pemulihan'}
      </button>

      <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px' }}>
        <Link to="/login" style={{ color: 'var(--accent)', fontWeight: '700' }}>
          ← Kembali ke Halaman Login
        </Link>
      </div>
    </form>
  )
}

