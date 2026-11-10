import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/providers/AuthProvider'
import { useUI } from '../app/providers/UIProvider'
import { CommandPalette } from '../components/ui/CommandPalette'

export default function AdminLayout() {
  const { user, profile, isSuperAdmin, signOut } = useAuth()
  const { theme, toggleTheme, openCommandPalette } = useUI()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  const navItems = [
    { path: '/admin', label: 'Ringkasan', icon: '⚡', desc: 'Overview & KPI' },
    { path: '/admin/members', label: 'Data Member', icon: '👥', desc: 'Kelola anggota' },
    { path: '/admin/accounts', label: 'Permohonan Rekening', icon: '💳', desc: 'Review & Setujui' },
    { path: '/admin/boxes', label: 'Kotak Tabungan', icon: '📦', desc: 'Resi & Pengiriman' },
    { path: '/admin/nfc', label: 'Tag NFC', icon: '📡', desc: 'Tulis & Verifikasi' },
    { path: '/admin/transactions', label: 'Transaksi', icon: '💸', desc: 'Validasi mutasi' },
    { path: '/admin/audit', label: 'Audit Trail', icon: '🛡️', desc: 'Log permanen' },
  ]

  const userInitial = profile?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'A'
  const userName = profile?.full_name || user?.email?.split('@')[0] || 'Admin'

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sidebar Header */}
      <div style={{
        padding: '18px 16px 14px',
        borderBottom: '1px solid rgba(139,92,246,0.2)',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(212,168,83,0.05))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
              display: 'grid', placeItems: 'center',
              fontWeight: '900', fontSize: '14px', color: '#fff',
              boxShadow: '0 4px 12px rgba(139,92,246,0.4)',
            }}>A</div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#f0f6fc', letterSpacing: '0.08em' }}>ADMIN CONSOLE</div>
              <div style={{ fontSize: '9px', color: '#8b5cf6', fontWeight: '700' }}>
                {isSuperAdmin ? '👑 Super Admin' : '🔧 Petugas Operasional'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              width: '26px', height: '26px', borderRadius: '6px', border: 'none',
              background: 'rgba(240,246,252,0.08)', color: '#8b949e',
              cursor: 'pointer', fontSize: '12px', display: 'grid', placeItems: 'center',
            }}
            className="mobile-close-btn"
          >✕</button>
        </div>
      </div>

      {/* Nav Section Label */}
      <div style={{ padding: '12px 16px 4px', fontSize: '10px', fontWeight: '800', color: '#656d76', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Menu Operasional
      </div>

      {/* Nav Links */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '10px',
                textDecoration: 'none', marginBottom: '2px',
                color: isActive ? '#fff' : '#8b949e',
                background: isActive
                  ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
                  : 'transparent',
                fontWeight: isActive ? '700' : '500',
                fontSize: '12.5px',
                transition: 'all 0.15s ease',
                border: isActive ? '1px solid rgba(139,92,246,0.4)' : '1px solid transparent',
                boxShadow: isActive ? '0 4px 12px rgba(139,92,246,0.3)' : 'none',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(240,246,252,0.05)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: '15px', flexShrink: 0 }}>{item.icon}</span>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ lineHeight: 1.2 }}>{item.label}</div>
                {!isActive && <div style={{ fontSize: '10px', color: '#656d76', marginTop: '1px' }}>{item.desc}</div>}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(240,246,252,0.08)', margin: '0 16px' }} />

      {/* Quick links */}
      <div style={{ padding: '10px 8px 4px' }}>
        <div style={{ fontSize: '10px', fontWeight: '800', color: '#656d76', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px 6px' }}>Navigasi Cepat</div>
        {[
          { to: '/', label: 'Kantor 3D', icon: '🏛️' },
          { to: '/dashboard', label: 'Portal Member', icon: '👤' },
        ].map(link => (
          <Link
            key={link.to}
            to={link.to}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 12px', borderRadius: '8px', textDecoration: 'none',
              color: '#8b949e', fontSize: '12px', fontWeight: '500', marginBottom: '2px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(240,246,252,0.05)'; e.currentTarget.style.color = '#f0f6fc' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8b949e' }}
          >
            <span>{link.icon}</span><span>{link.label}</span>
          </Link>
        ))}
      </div>

      {/* Sidebar Footer - User + Sign Out */}
      <div style={{
        padding: '12px', borderTop: '1px solid rgba(240,246,252,0.08)',
        margin: '8px 0 0',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '8px 10px', borderRadius: '10px',
          background: 'rgba(240,246,252,0.04)',
          marginBottom: '8px',
        }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b1f6e, #2a1554)',
            border: '2px solid rgba(139,92,246,0.5)',
            display: 'grid', placeItems: 'center',
            fontWeight: '800', fontSize: '12px', color: '#c4b5fd', flexShrink: 0,
          }}>{userInitial}</div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#f0f6fc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
            <div style={{ fontSize: '10px', color: '#656d76', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
          </div>
        </div>
        <button
          onClick={() => signOut().then(() => navigate('/'))}
          style={{
            width: '100%', padding: '8px', borderRadius: '8px',
            border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)',
            color: '#f87171', fontWeight: '700', fontSize: '12px', cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >Keluar dari Sesi</button>

        <div style={{ marginTop: '10px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', fontSize: '10px', color: '#8b5cf6', lineHeight: '1.4', textAlign: 'center' }}>
          🔒 Sesi Aman • Semua mutasi tercatat permanen
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0d1117', color: '#f0f6fc' }}>
      {/* ─── Mobile Backdrop ─── */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 149,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* ─── Admin Topbar ─── */}
      <header style={{
        height: '56px', flexShrink: 0,
        background: '#161b22',
        borderBottom: '1px solid rgba(139,92,246,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 0 rgba(139,92,246,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              width: '32px', height: '32px', borderRadius: '8px', border: 'none',
              background: 'rgba(139,92,246,0.15)', color: '#c4b5fd',
              cursor: 'pointer', fontSize: '14px', display: 'none', placeItems: 'center',
            }}
            className="admin-hamburger"
          >☰</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '7px',
              background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
              display: 'grid', placeItems: 'center', fontWeight: '900', fontSize: '13px', color: '#fff',
              boxShadow: '0 2px 8px rgba(139,92,246,0.4)',
            }}>A</div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '0.05em', color: '#f0f6fc' }}>NARAYAN ADMIN</div>
              <div style={{ fontSize: '9px', color: '#8b5cf6', fontWeight: '700' }}>
                {isSuperAdmin ? 'Super Administrator' : 'Petugas Operasional'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Smart Command Search */}
          <button
            type="button"
            onClick={openCommandPalette}
            title="Cari & Jalankan Perintah Admin (Cmd+K)"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 10px', borderRadius: '8px',
              background: 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.25)',
              color: '#c4b5fd', fontSize: '12px', cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span>🔍</span>
            <span className="hide-mobile" style={{ fontSize: '11px', fontWeight: '600' }}>Cari</span>
            <kbd className="hide-mobile" style={{
              background: 'rgba(139,92,246,0.2)', padding: '1px 5px',
              borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace',
            }}>⌘K</kbd>
          </button>

          {/* Theme Mode Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            title={`Ubah ke Mode ${theme === 'dark' ? 'Terang' : 'Gelap'}`}
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              border: '1px solid rgba(139,92,246,0.25)',
              background: 'rgba(139,92,246,0.1)',
              color: '#c4b5fd',
              cursor: 'pointer', display: 'grid', placeItems: 'center',
              fontSize: '13px', transition: 'all 0.15s ease',
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          <div style={{
            padding: '4px 10px', borderRadius: '20px',
            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
            fontSize: '10px', fontWeight: '800', color: '#c4b5fd', letterSpacing: '0.05em',
          }} className="hide-mobile">🔴 LIVE</div>
          <div style={{ fontSize: '11px', color: '#656d76', borderLeft: '1px solid rgba(240,246,252,0.08)', paddingLeft: '12px' }} className="hide-mobile">
            {userName}
          </div>
        </div>
      </header>

      {/* ─── Body: Sidebar + Content ─── */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', minHeight: 'calc(100vh - 56px)' }}>
        {/* Desktop Sidebar */}
        <aside style={{
          width: '240px', flexShrink: 0,
          background: '#161b22',
          borderRight: '1px solid rgba(139,92,246,0.1)',
          position: 'sticky',
          top: '56px',
          height: 'calc(100vh - 56px)',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }} className="desktop-sidebar">
          <SidebarContent />
        </aside>

        {/* Mobile Drawer Sidebar */}
        <aside style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 150,
          width: '260px',
          background: '#161b22',
          borderRight: '1px solid rgba(139,92,246,0.2)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.6)',
          overflowY: 'auto',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        }} className="mobile-sidebar">
          <SidebarContent />
        </aside>

        {/* Main Content */}
        <main style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'visible',
          padding: 'clamp(16px, 2.5vw, 30px)',
          paddingBottom: '80px',
          background: '#0d1117',
        }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .admin-hamburger { display: grid !important; }
          .hide-mobile { display: none !important; }
        }
        @media (min-width: 769px) {
          .mobile-sidebar { display: none !important; }
          .mobile-close-btn { display: none !important; }
        }
      `}</style>
      {/* Intelligent Command Palette (Cmd+K) */}
      <CommandPalette />
    </div>
  )
}
