import { Outlet, Link } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="auth-bg">
  <div className="auth-card">
    <div className="auth-header">
      <div className="auth-logo">
        N
      </div>
      <h2 className="auth-title">NARAYAN VIRTUAL BANK</h2>
      <p className="auth-subtitle">Realtime Self-Saving NFC System</p>
    </div>
    <Outlet />
    <div className="auth-footer">
      <Link to="/" className="auth-back-link">← Kembali ke Kantor Virtual 3D</Link>
    </div>
  </div>
</div>
  )
}

