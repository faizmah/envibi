import { Outlet, Link } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'radial-gradient(circle at 50% 20%, #1e334a 0%, #17212d 100%)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        padding: '32px 28px',
        background: 'rgba(21, 31, 44, 0.92)',
        backdropFilter: 'blur(16px)',
        borderRadius: '20px',
        border: '1px solid rgba(220, 230, 240, 0.15)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #e1bd7b, #c39a58)',
            color: '#17212d',
            fontSize: '24px',
            fontWeight: '900',
            marginBottom: '12px',
            boxShadow: '0 8px 24px rgba(195, 154, 88, 0.35)',
          }}>
            N
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: '20px', letterSpacing: '0.04em', fontWeight: '800' }}>
            NARAYAN VIRTUAL BANK
          </h2>
          <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: '12px' }}>
            Realtime Self-Saving NFC System
          </p>
        </div>

        <Outlet />

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '11px', color: 'var(--fg-muted)' }}>
          <Link to="/" style={{ color: 'var(--accent2)', fontWeight: '700' }}>← Kembali ke Kantor Virtual 3D</Link>
        </div>
      </div>
    </div>
  )
}

