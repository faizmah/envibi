import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/providers/AuthProvider'
import { useUI } from '../app/providers/UIProvider'
import { CommandPalette } from '../components/ui/CommandPalette'

// ─── Admin Navigation Items ───────────────────────────────────────────────────
const ADMIN_NAV = [
  { path: '/admin',              label: 'Ringkasan',         icon: '⚡', desc: 'Overview & KPI' },
  { path: '/admin/accounts',     label: 'Permohonan Rekening', icon: '💳', desc: 'Review & Setujui' },
  { path: '/admin/members',      label: 'Data Member',       icon: '👥', desc: 'Kelola anggota' },
  { path: '/admin/boxes',        label: 'Kotak Tabungan',    icon: '📦', desc: 'Resi & Pengiriman' },
  { path: '/admin/nfc',          label: 'Tag NFC',           icon: '📡', desc: 'Tulis & Verifikasi' },
  { path: '/admin/transactions', label: 'Transaksi',         icon: '💸', desc: 'Validasi mutasi' },
  { path: '/admin/audit',        label: 'Audit Trail',       icon: '🛡️', desc: 'Log permanen' },
]

// ─── ADMIN LOGOUT CONFIRMATION MODAL ──────────────────────────────────────────
function AdminLogoutModal({ onConfirm, onCancel, loading }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      animation: 'fadeIn 0.2s ease',
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--bg-surface, #161b22)',
        border: '1px solid rgba(139,92,246,0.3)',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '420px',
        width: '100%',
        boxShadow: '0 20px 48px rgba(0,0,0,0.6), 0 0 24px rgba(139,92,246,0.2)',
        textAlign: 'center',
        animation: 'slideUp 0.25s ease',
      }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '14px',
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
          display: 'grid', placeItems: 'center', margin: '0 auto 16px',
          fontSize: '24px',
        }}>
          🚪
        </div>

        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '800', color: 'var(--text-primary, #f0f6fc)' }}>
          Konfirmasi Keluar Sesi Admin
        </h3>
        <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--text-secondary, #8b949e)', lineHeight: '1.5' }}>
          Apakah Anda yakin ingin mengakhiri sesi Administrator ini? Anda harus login kembali untuk mengakses panel operasional bank.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '10px 16px', borderRadius: '10px',
              border: '1px solid var(--border, rgba(240,246,252,0.12))',
              background: 'transparent',
              color: 'var(--text-primary, #f0f6fc)',
              fontSize: '13px', fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '10px 16px', borderRadius: '10px',
              border: '1px solid #ef4444',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#ffffff',
              fontSize: '13px', fontWeight: '800',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(239,68,68,0.35)',
            }}
          >
            {loading ? 'Mengeluarkan...' : '🚪 Ya, Keluar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const { user, profile, isSuperAdmin, signOut } = useAuth()
  const { theme, toggleTheme, openCommandPalette } = useUI()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  const userInitial = profile?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'A'
  const userName    = profile?.full_name || user?.email?.split('@')[0] || 'Admin'

  const handleLogoutConfirm = async () => {
    setLoggingOut(true)
    try {
      await signOut()
      navigate('/login')
    } finally {
      setLoggingOut(false)
      setShowLogoutModal(false)
    }
  }

  // ─── Sidebar Content (shared between desktop & mobile) ──────────────────────
  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Sidebar Brand Header ── */}
      <div style={{
        padding: '18px 16px 14px',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(91,33,182,0.1))',
        borderBottom: '1px solid rgba(139,92,246,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Admin logo mark */}
            <div style={{
              width: '34px', height: '34px', borderRadius: '9px',
              background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
              display: 'grid', placeItems: 'center',
              fontWeight: '900', fontSize: '17px', color: '#fff',
              boxShadow: '0 4px 14px rgba(139,92,246,0.5)',
            }}>⚙</div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '900', color: '#f0f6fc', letterSpacing: '0.08em' }}>ADMIN CONSOLE</div>
              <div style={{ fontSize: '9px', color: '#8b5cf6', fontWeight: '700', marginTop: '1px' }}>
                {isSuperAdmin ? '👑 Super Administrator' : '🔧 Petugas Operasional'}
              </div>
            </div>
          </div>
          {/* Mobile close button */}
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

        {/* Admin role badge strip */}
        <div style={{
          padding: '6px 10px', borderRadius: '8px',
          background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #3b1f6e, #2a1554)',
            border: '2px solid rgba(139,92,246,0.5)',
            display: 'grid', placeItems: 'center',
            fontWeight: '800', fontSize: '12px', color: '#c4b5fd',
          }}>{userInitial}</div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#f0f6fc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
            <div style={{ fontSize: '9px', color: '#8b5cf6', fontWeight: '600' }}>{user?.email?.split('@')[0]}</div>
          </div>
          <span style={{
            fontSize: '8px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
            background: 'rgba(139,92,246,0.3)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.5)',
            textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
          }}>ADMIN</span>
        </div>
      </div>

      {/* ── Divider + Section Label ── */}
      <div style={{ padding: '12px 16px 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(139,92,246,0.15)' }} />
        <span style={{ fontSize: '9px', fontWeight: '800', color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
          Menu Operasional Admin
        </span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(139,92,246,0.15)' }} />
      </div>

      {/* ── Admin Nav Links ── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
        {ADMIN_NAV.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '10px',
                textDecoration: 'none', marginBottom: '3px',
                color: isActive ? '#fff' : '#a78bfa',
                background: isActive
                  ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
                  : 'rgba(139,92,246,0.06)',
                fontWeight: isActive ? '700' : '500',
                fontSize: '12.5px',
                transition: 'all 0.15s ease',
                border: isActive
                  ? '1px solid rgba(139,92,246,0.5)'
                  : '1px solid rgba(139,92,246,0.1)',
                boxShadow: isActive ? '0 4px 12px rgba(139,92,246,0.35)' : 'none',
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(139,92,246,0.14)'; e.currentTarget.style.color = '#c4b5fd' } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(139,92,246,0.06)'; e.currentTarget.style.color = '#a78bfa' } }}
            >
              <span style={{ fontSize: '15px', flexShrink: 0 }}>{item.icon}</span>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </div>
                {!isActive && (
                  <div style={{ fontSize: '9.5px', color: '#7c3aed', marginTop: '2px', opacity: 0.8 }}>
                    {item.desc}
                  </div>
                )}
              </div>
              {isActive && (
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: '#c4b5fd', flexShrink: 0,
                }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Divider ── */}
      <div style={{ height: '1px', background: 'rgba(139,92,246,0.12)', margin: '4px 16px' }} />

      {/* ── Navigasi Eksternal ── */}
      <div style={{ padding: '10px 8px 4px' }}>
        <div style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted, #656d76)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px 6px' }}>
          Navigasi Sistem
        </div>
        {[
          { to: '/', label: 'Kantor 3D Virtual', icon: '🏛️' },
        ].map(link => (
          <Link
            key={link.to}
            to={link.to}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 12px', borderRadius: '8px', textDecoration: 'none',
              color: 'var(--text-secondary, #8b949e)',
              fontSize: '12px', fontWeight: '600',
              marginBottom: '2px',
              background: 'transparent',
              border: '1px solid transparent',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; e.currentTarget.style.color = 'var(--text-primary, #f0f6fc)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary, #8b949e)' }}
          >
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        ))}
      </div>

      {/* ── Sidebar Footer ── */}
      <div style={{
        padding: '10px 12px 14px',
        borderTop: '1px solid rgba(139,92,246,0.15)',
        marginTop: '6px',
      }}>
        <button
          type="button"
          onClick={() => setShowLogoutModal(true)}
          style={{
            width: '100%', padding: '9px', borderRadius: '8px',
            border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)',
            color: '#ef4444', fontWeight: '700', fontSize: '12px', cursor: 'pointer',
            transition: 'all 0.15s', marginBottom: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
        >🚪 Keluar dari Sesi Admin</button>

        <div style={{
          padding: '7px 10px', borderRadius: '8px',
          background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)',
          fontSize: '9.5px', color: 'var(--accent-purple, #7c3aed)', lineHeight: '1.5', textAlign: 'center',
        }}>
          🔒 Sesi Aman Admin • Auto-logout 1 Jam
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg, #0d1117)', color: 'var(--text-primary, #f0f6fc)' }}>

      {/* Modal Konfirmasi Logout Admin */}
      {showLogoutModal && (
        <AdminLogoutModal
          onConfirm={handleLogoutConfirm}
          onCancel={() => setShowLogoutModal(false)}
          loading={loggingOut}
        />
      )}

      {/* ─── Mobile Backdrop ─────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 149,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* ─── Admin Topbar ────────────────────────────────────────────── */}
      <header style={{
        height: '56px', flexShrink: 0,
        background: 'var(--bg-surface, #161b22)',
        borderBottom: '2px solid rgba(139,92,246,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 20px rgba(139,92,246,0.12)',
      }}>
        {/* Left: Hamburger + Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            {/* Admin logo in topbar */}
            <div style={{
              width: '28px', height: '28px', borderRadius: '7px',
              background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
              display: 'grid', placeItems: 'center', fontWeight: '900', fontSize: '14px', color: '#fff',
              boxShadow: '0 2px 8px rgba(139,92,246,0.4)',
            }}>⚙</div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '900', letterSpacing: '0.06em', color: 'var(--text-primary, #f0f6fc)' }}>
                NARAYAN <span style={{ color: '#8b5cf6' }}>ADMIN</span>
              </div>
              <div style={{ fontSize: '9px', color: '#8b5cf6', fontWeight: '700' }}>
                {isSuperAdmin ? '👑 Super Administrator' : '🔧 Petugas Operasional'}
              </div>
            </div>
          </div>

          {/* Visual separator */}
          <div style={{ height: '28px', width: '1px', background: 'rgba(139,92,246,0.3)' }} className="hide-mobile" />

          {/* Admin mode badge */}
          <div style={{
            padding: '3px 10px', borderRadius: '20px',
            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)',
            fontSize: '10px', fontWeight: '800', color: 'var(--accent-purple, #8b5cf6)', letterSpacing: '0.06em',
            display: 'flex', alignItems: 'center', gap: '5px',
          }} className="hide-mobile">
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            KONSOL ADMIN AKTIF
          </div>
        </div>

        {/* Right: Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Search */}
          <button
            type="button" onClick={openCommandPalette}
            title="Cari & Jalankan Perintah Admin (Cmd+K)"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 10px', borderRadius: '8px',
              background: 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.3)',
              color: 'var(--text-primary, #f0f6fc)', fontSize: '11.5px', cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span>🔍</span>
            <span className="hide-mobile" style={{ fontSize: '11px', fontWeight: '600' }}>Cari</span>
            <kbd className="hide-mobile" style={{
              background: 'rgba(139,92,246,0.25)', padding: '1px 5px',
              borderRadius: '4px', fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-primary, #f0f6fc)',
            }}>⌘K</kbd>
          </button>

          {/* Theme Toggle */}
          <button
            type="button" onClick={toggleTheme}
            title={`Mode ${theme === 'dark' ? 'Terang' : 'Gelap'}`}
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              border: '1px solid rgba(139,92,246,0.3)',
              background: 'rgba(139,92,246,0.1)', color: 'var(--text-primary, #f0f6fc)',
              cursor: 'pointer', display: 'grid', placeItems: 'center',
              fontSize: '13px', transition: 'all 0.15s ease',
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* Quick Logout Button */}
          <button
            type="button"
            onClick={() => setShowLogoutModal(true)}
            title="Keluar dari Sesi Admin"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '6px 12px', borderRadius: '8px',
              border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)',
              color: '#ef4444', fontSize: '11.5px', fontWeight: '700',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            <span>🚪</span>
            <span className="hide-mobile">Keluar</span>
          </button>

          {/* User name + role */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '4px 10px', borderRadius: '20px',
            background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)',
          }} className="hide-mobile">
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b1f6e, #2a1554)',
              border: '1.5px solid rgba(139,92,246,0.5)',
              display: 'grid', placeItems: 'center',
              fontWeight: '800', fontSize: '10px', color: '#c4b5fd',
            }}>{userInitial}</div>
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary, #f0f6fc)' }}>{userName}</div>
              <div style={{ fontSize: '8px', color: '#7c3aed', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {isSuperAdmin ? 'Super Admin' : 'Petugas'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Body: Sidebar + Content ─────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', minHeight: 'calc(100vh - 56px)' }}>

        {/* Desktop Sidebar */}
        <aside style={{
          width: '245px', flexShrink: 0,
          background: 'var(--bg-surface, #161b22)',
          borderRight: '1px solid rgba(139,92,246,0.15)',
          position: 'sticky', top: '56px',
          height: 'calc(100vh - 56px)',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }} className="desktop-sidebar">
          <SidebarContent />
        </aside>

        {/* Mobile Drawer Sidebar */}
        <aside style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 150,
          width: '265px',
          background: 'var(--bg-surface, #161b22)',
          borderRight: '1px solid rgba(139,92,246,0.25)',
          boxShadow: '4px 0 32px rgba(0,0,0,0.7)',
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
          background: 'var(--bg, #0d1117)',
        }}>
          <Outlet />
        </main>
      </div>

      {/* ─── Responsive CSS ───────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar  { display: none !important; }
          .admin-hamburger  { display: grid !important; }
          .hide-mobile      { display: none !important; }
        }
        @media (min-width: 769px) {
          .mobile-sidebar   { display: none !important; }
          .mobile-close-btn { display: none !important; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>

      {/* Intelligent Command Palette (Cmd+K) */}
      <CommandPalette />
    </div>
  )
}
