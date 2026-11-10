import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/providers/AuthProvider'

export default function AdminLayout() {
  const { user, profile, isSuperAdmin, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const navItems = [
    { path: '/admin', label: '📊 Ringkasan Admin', icon: '⚡' },
    { path: '/admin/members', label: '👥 Data Member', icon: '👤' },
    { path: '/admin/accounts', label: '💳 Permohonan Rekening', icon: '📝' },
    { path: '/admin/boxes', label: '📦 Kotak Tabungan & Resi', icon: '📫' },
    { path: '/admin/nfc', label: '📡 Penulisan & Tag NFC', icon: '🏷️' },
    { path: '/admin/transactions', label: '💸 Transaksi & Validasi', icon: '💰' },
    { path: '/admin/audit', label: '🛡️ Audit Trail Log', icon: '📜' },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0e1722', color: '#edf2f7' }}>
      {/* Admin Topbar */}
      <header style={{
        height: '60px',
        background: '#15212e',
        borderBottom: '1px solid rgba(220, 230, 240, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #e74c3c, #9b59b6)',
            display: 'grid',
            placeItems: 'center',
            fontWeight: '900',
            fontSize: '15px',
          }}>
            A
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '15px', fontWeight: '800', letterSpacing: '0.04em' }}>
              NARAYAN ADMIN CONSOLE
            </h1>
            <small style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>
              {isSuperAdmin ? 'Super Administrator Access' : 'Operational Officer Access'}
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/" className="btn btn-sm btn-secondary">
            🏛️ Ke Kantor 3D
          </Link>
          <Link to="/dashboard" className="btn btn-sm btn-secondary">
            👤 Mode Member
          </Link>
          <div style={{ fontSize: '12px', color: 'var(--fg-muted)', borderLeft: '1px solid var(--border)', paddingLeft: '12px' }}>
            {profile?.full_name || user?.email}
          </div>
          <button onClick={() => signOut().then(() => navigate('/'))} className="btn btn-sm btn-danger">
            Keluar
          </button>
        </div>
      </header>

      {/* Admin Body (Sidebar + Content) */}
      <div style={{ flex: 1, display: 'flex' }}>
        <aside style={{
          width: '240px',
          background: '#121c27',
          borderRight: '1px solid rgba(220, 230, 240, 0.08)',
          padding: '16px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          <div style={{ padding: '0 8px 10px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-muted)', fontWeight: '800' }}>
            Menu Utama
          </div>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  color: isActive ? '#17212d' : '#edf2f7',
                  background: isActive ? '#c39a58' : 'transparent',
                  fontWeight: isActive ? '800' : '600',
                  fontSize: '12.5px',
                  transition: 'background 0.15s',
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}

          <div style={{ marginTop: 'auto', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', fontSize: '11px', color: 'var(--fg-muted)', lineHeight: '1.5' }}>
            🔒 Sesi Operasional Aman. Seluruh mutasi & persetujuan dicatat permanen dalam Audit Log.
          </div>
        </aside>

        <section style={{ flex: 1, padding: '24px 30px', overflowY: 'auto' }}>
          <Outlet />
        </section>
      </div>
    </div>
  )
}

