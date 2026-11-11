import { useState, useEffect, useRef } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/providers/AuthProvider'
import { useUI } from '../app/providers/UIProvider'
import { CommandPalette } from '../components/ui/CommandPalette'
import { supabase } from '../services/supabase/client'
import { subscribeToNotifications } from '../services/realtime/realtimeService'
import { formatRupiah } from '../utils/format'

// ─── GROUPED MEMBER SIDEBAR NAV ──────────────────────────────────────────────
const SIDEBAR_GROUPS = [
  {
    label: 'Utama',
    items: [
      { to: '/',          label: 'Kantor 3D',  icon: '🏛️', desc: 'Virtual office 3D' },
      { to: '/dashboard', label: 'Dashboard',  icon: '📊', desc: 'Ringkasan akun' },
    ],
  },
  {
    label: 'Transaksi',
    items: [
      { to: '/deposit',      label: 'Setor Dana',  icon: '📥', desc: 'Tambah saldo' },
      { to: '/withdrawal',   label: 'Tarik Dana',  icon: '📤', desc: 'Ambil saldo' },
      { to: '/transactions', label: 'Riwayat',     icon: '📋', desc: 'Histori mutasi' },
    ],
  },
  {
    label: 'Layanan',
    items: [
      { to: '/accounts/apply', label: 'Pesan Tabungan', icon: '📝', desc: 'Buka rekening & kotak' },
      { to: '/box/activate',   label: 'Kotak NFC',      icon: '📦', desc: 'Aktifkan kotak' },
      { to: '/reports',        label: 'Laporan',        icon: '📈', desc: 'Rekap keuangan' },
    ],
  },
]

// ─── ADMIN NAV (tab terpisah) ─────────────────────────────────────────────────
const ADMIN_NAV = [
  { to: '/admin',              label: 'Ringkasan Bank',   icon: '⚡' },
  { to: '/admin/accounts',     label: 'Review Pengajuan', icon: '💳' },
  { to: '/admin/members',      label: 'Data Anggota',     icon: '👥' },
  { to: '/admin/boxes',        label: 'Kotak Tabungan',   icon: '📦' },
  { to: '/admin/nfc',          label: 'Tulis Tag NFC',    icon: '📡' },
  { to: '/admin/transactions', label: 'Monitor Mutasi',   icon: '💸' },
  { to: '/admin/audit',        label: 'Audit Trail',      icon: '🛡️' },
]

// ─── LOGOUT CONFIRMATION MODAL ────────────────────────────────────────────────
function LogoutModal({ onConfirm, onCancel, loading }) {
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
        background: 'var(--bg-elevated, #1c2128)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '16px',
        padding: '28px 24px 24px',
        maxWidth: '380px', width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)',
        textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'rgba(239,68,68,0.12)',
          border: '2px solid rgba(239,68,68,0.3)',
          display: 'grid', placeItems: 'center',
          margin: '0 auto 16px', fontSize: '24px',
        }}>🚪</div>

        <h2 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: '800', color: 'var(--text-primary, #f0f6fc)' }}>
          Keluar dari Akun?
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--text-secondary, #8b949e)', lineHeight: '1.5' }}>
          Sesi Anda akan diakhiri. Pastikan semua transaksi sudah selesai sebelum keluar.
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              border: '1px solid var(--border, rgba(240,246,252,0.15))',
              background: 'transparent',
              color: 'var(--text-primary, #f0f6fc)', fontSize: '13px', fontWeight: '700',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              border: '1px solid rgba(239,68,68,0.4)',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#ffffff', fontSize: '13px', fontWeight: '800',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              boxShadow: '0 4px 14px rgba(239,68,68,0.3)',
            }}
          >
            {loading ? (
              <>
                <span style={{
                  width: '12px', height: '12px', borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#ffffff',
                  display: 'inline-block',
                  animation: 'spin 0.7s linear infinite',
                }} />
                Keluar...
              </>
            ) : '🚪 Ya, Keluar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MINI PROFILE DROPDOWN ────────────────────────────────────────────────────
function ProfileDropdown({ user, profile, isAdmin, onLogoutRequest, theme, toggleTheme }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const userInitial = profile?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || '?'
  const userName    = profile?.full_name || user?.email?.split('@')[0] || 'Member'

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Avatar button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '5px 10px 5px 5px', borderRadius: '24px',
          border: `1px solid ${open
            ? (isAdmin ? 'rgba(139,92,246,0.5)' : 'rgba(212,168,83,0.5)')
            : 'rgba(240,246,252,0.12)'}`,
          background: open ? 'rgba(240,246,252,0.08)' : 'transparent',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
        aria-label="Profil"
      >
        {/* Avatar circle */}
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
          background: isAdmin
            ? 'linear-gradient(135deg, #4c1d95, #2e1065)'
            : 'linear-gradient(135deg, #2d4a3e, #1a3028)',
          border: isAdmin ? '2px solid #8b5cf6' : '2px solid #d4a853',
          display: 'grid', placeItems: 'center',
          fontWeight: '800', fontSize: '12px',
          color: isAdmin ? '#c4b5fd' : '#d4a853',
        }}>{userInitial}</div>

        {/* Name + role */}
        <div style={{ textAlign: 'left' }} className="hide-mobile">
          <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-primary, #f0f6fc)', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userName}
          </div>
          <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: isAdmin ? '#8b5cf6' : '#10b981' }}>
            {isAdmin ? '👑 Admin' : '🏦 Nasabah'}
          </div>
        </div>

        {/* Chevron */}
        <span style={{
          fontSize: '10px', color: 'var(--text-secondary, #656d76)',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
        }} className="hide-mobile">▼</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: '220px',
          background: 'var(--bg-elevated, #1c2128)',
          border: '1px solid var(--border, rgba(240,246,252,0.12))',
          borderRadius: '14px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          animation: 'slideDown 0.18s cubic-bezier(0.4,0,0.2,1)',
          zIndex: 200,
        }}>
          {/* User info header */}
          <div style={{
            padding: '14px 16px 12px',
            borderBottom: '1px solid var(--border, rgba(240,246,252,0.08))',
            background: isAdmin
              ? 'linear-gradient(135deg, rgba(139,92,246,0.1), transparent)'
              : 'linear-gradient(135deg, rgba(212,168,83,0.08), transparent)',
          }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary, #f0f6fc)', marginBottom: '2px' }}>{userName}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary, #656d76)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
            <div style={{ marginTop: '6px' }}>
              <span style={{
                fontSize: '9px', fontWeight: '800', padding: '2px 7px', borderRadius: '4px',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                background: isAdmin ? 'rgba(139,92,246,0.2)' : 'rgba(16,185,129,0.15)',
                color: isAdmin ? '#c4b5fd' : '#10b981',
                border: isAdmin ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(16,185,129,0.3)',
              }}>
                {isAdmin ? '👑 Admin' : '🏦 Nasabah'}
              </span>
            </div>
          </div>

          {/* Menu items */}
          <div style={{ padding: '6px' }}>
            <DropdownItem icon="👤" label="Profil Saya" to="/profile" onClick={() => setOpen(false)} />
            <DropdownItem icon="⚙️" label="Pengaturan" to="/settings" onClick={() => setOpen(false)} />

            {/* Theme toggle */}
            <button
              onClick={() => { toggleTheme(); }}
              style={dropdownBtnStyle}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--border-muted, rgba(240,246,252,0.06))'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: '15px' }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
              <span style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-secondary, #8b949e)' }}>
                Mode {theme === 'dark' ? 'Terang' : 'Gelap'}
              </span>
            </button>

            <div style={{ height: '1px', background: 'var(--border, rgba(240,246,252,0.08))', margin: '6px 0' }} />

            {/* Logout */}
            <button
              onClick={() => { setOpen(false); onLogoutRequest() }}
              style={{ ...dropdownBtnStyle, color: '#ef4444' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.querySelector('span:last-child').style.color = '#ef4444' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.querySelector('span:last-child').style.color = '#ef4444' }}
            >
              <span style={{ fontSize: '15px' }}>🚪</span>
              <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#ef4444' }}>Keluar dari Akun</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const dropdownBtnStyle = {
  display: 'flex', alignItems: 'center', gap: '10px',
  width: '100%', padding: '8px 10px', borderRadius: '8px',
  border: 'none', background: 'transparent',
  cursor: 'pointer', transition: 'background 0.12s', textAlign: 'left',
}

function DropdownItem({ icon, label, to, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 10px', borderRadius: '8px', textDecoration: 'none',
        transition: 'background 0.12s',
        color: 'var(--text-secondary, #8b949e)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--border-muted, rgba(240,246,252,0.06))'; e.currentTarget.style.color = 'var(--text-primary, #f0f6fc)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary, #8b949e)' }}
    >
      <span style={{ fontSize: '15px' }}>{icon}</span>
      <span style={{ fontSize: '12.5px', fontWeight: '600' }}>{label}</span>
    </Link>
  )
}

// ─── MAIN LAYOUT ──────────────────────────────────────────────────────────────
export default function AppLayout() {
  const { user, profile, isAdmin, signOut } = useAuth()
  const { theme, toggleTheme, openCommandPalette } = useUI()
  const location  = useLocation()
  const navigate  = useNavigate()

  const [unreadCount,    setUnreadCount]    = useState(0)
  const [totalBalance,   setTotalBalance]   = useState(0)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [sidebarOpen,    setSidebarOpen]    = useState(false)   // mobile drawer
  const [drawerTab,      setDrawerTab]      = useState('member')
  const [showLogout,     setShowLogout]     = useState(false)
  const [loggingOut,     setLoggingOut]     = useState(false)

  // 3D virtual office = no scroll, no sidebar chrome
  const isVirtualOffice = location.pathname === '/'

  // Lock body & html scroll completely when on 3D virtual office
  useEffect(() => {
    if (isVirtualOffice) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
        document.documentElement.style.overflow = ''
      }
    }
  }, [isVirtualOffice])

  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  // Auto-switch drawer tab based on route
  useEffect(() => {
    setDrawerTab(location.pathname.startsWith('/admin') ? 'admin' : 'member')
  }, [location.pathname])

  useEffect(() => {
    if (!user) return
    async function loadQuickData() {
      try {
        const { data: accs } = await supabase
          .from('accounts').select('book_balance')
          .eq('user_id', user.id).eq('status', 'ACTIVE')
        if (accs) setTotalBalance(accs.reduce((s, a) => s + Number(a.book_balance || 0), 0))
        const { count } = await supabase
          .from('notifications').select('*', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('is_read', false)
        setUnreadCount(count || 0)
      } catch (err) {
        console.warn('loadQuickData:', err?.message || err)
      }
    }
    loadQuickData()
    const unsub = subscribeToNotifications(user.id, () => setUnreadCount(c => c + 1))
    return () => unsub?.()
  }, [user])

  const handleLogoutConfirm = async () => {
    setLoggingOut(true)
    try {
      await signOut()
      navigate('/login')
    } finally {
      setLoggingOut(false)
      setShowLogout(false)
    }
  }

  // ── Sidebar link style ──────────────────────────────────────────────────────
  const memberLink = (active) => ({
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 12px', borderRadius: '10px', textDecoration: 'none',
    marginBottom: '2px', fontSize: '12.5px', fontWeight: active ? '800' : '500',
    color: active ? '#0d1117' : '#8b949e',
    background: active ? 'linear-gradient(135deg, #d4a853, #b8892e)' : 'transparent',
    boxShadow: active ? '0 4px 12px rgba(212,168,83,0.3)' : 'none',
    border: active ? '1px solid rgba(212,168,83,0.5)' : '1px solid transparent',
    transition: 'all 0.15s ease',
  })

  const adminLink = (active) => ({
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 12px', borderRadius: '10px', textDecoration: 'none',
    marginBottom: '2px', fontSize: '12.5px', fontWeight: active ? '700' : '500',
    color: active ? '#fff' : '#a78bfa',
    background: active ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : 'rgba(139,92,246,0.06)',
    boxShadow: active ? '0 4px 12px rgba(139,92,246,0.4)' : 'none',
    border: active ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.1)',
    transition: 'all 0.15s ease',
  })

  const userInitial = profile?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || '?'
  const userName    = profile?.full_name || user?.email?.split('@')[0] || 'Member'

  // ── Sidebar inner content ───────────────────────────────────────────────────
  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Brand */}
      <div style={{
        padding: '16px',
        borderBottom: drawerTab === 'admin'
          ? '1px solid rgba(139,92,246,0.2)'
          : '1px solid rgba(240,246,252,0.08)',
        background: drawerTab === 'admin'
          ? 'linear-gradient(135deg, rgba(139,92,246,0.1), transparent)'
          : 'linear-gradient(135deg, rgba(212,168,83,0.07), transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: drawerTab === 'admin'
              ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
              : 'linear-gradient(135deg, #d4a853, #b8892e)',
            display: 'grid', placeItems: 'center',
            fontWeight: '900', fontSize: '15px',
            color: drawerTab === 'admin' ? '#fff' : '#0d1117',
            boxShadow: drawerTab === 'admin'
              ? '0 4px 12px rgba(139,92,246,0.4)'
              : '0 4px 12px rgba(212,168,83,0.35)',
          }}>{drawerTab === 'admin' ? '⚙' : 'N'}</div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '900', color: '#f0f6fc', letterSpacing: '0.04em' }}>
              {drawerTab === 'admin' ? 'ADMIN CONSOLE' : 'NARAYAN BANK'}
            </div>
            <div style={{ fontSize: '9px', fontWeight: '600', color: drawerTab === 'admin' ? '#8b5cf6' : '#656d76' }}>
              {drawerTab === 'admin' ? '🛡️ Konsol Administrator' : '👤 Portal Nasabah'}
            </div>
          </div>
        </div>
        {/* Mobile close button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="mobile-close-btn"
          style={{
            width: '26px', height: '26px', borderRadius: '6px', border: 'none',
            background: 'rgba(240,246,252,0.08)', color: '#8b949e',
            cursor: 'pointer', fontSize: '12px', display: 'grid', placeItems: 'center',
          }}
        >✕</button>
      </div>

      {/* Nav area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>

        {/* ── JIKA ADMIN: Langsung tampilkan Menu Operasional Admin (tanpa dashboard member) ── */}
        {isAdmin ? (
          <>
            <div style={{
              fontSize: '9px', fontWeight: '800', color: 'var(--accent-purple, #8b5cf6)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              padding: '0 8px 8px', marginBottom: '4px',
            }}>Menu Operasional Admin</div>
            {ADMIN_NAV.map(item => {
              const active = location.pathname === item.path || location.pathname === item.to
              const to = item.path || item.to
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setSidebarOpen(false)}
                  style={adminLink(active)}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(139,92,246,0.14)'; e.currentTarget.style.color = '#c4b5fd' } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'rgba(139,92,246,0.06)'; e.currentTarget.style.color = 'var(--accent-purple, #8b5cf6)' } }}
                >
                  <span style={{ fontSize: '15px' }}>{item.icon}</span>
                  <span>{item.label}</span>
                  {active && <span style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: '#c4b5fd', flexShrink: 0 }} />}
                </Link>
              )
            })}
          </>
        ) : (
          /* ── JIKA MEMBER: Tampilkan Menu Member ── */
          <>
            {user ? (
              <>
                {/* Balance pill inside sidebar */}
                <div
                  onClick={() => setBalanceVisible(v => !v)}
                  style={{
                    padding: '10px 12px', borderRadius: '10px', marginBottom: '12px',
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.2)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '9.5px', color: 'var(--text-secondary, #656d76)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Saldo</div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
                      {balanceVisible ? formatRupiah(totalBalance) : '••••••'}
                    </div>
                  </div>
                  <span style={{ fontSize: '14px' }}>{balanceVisible ? '👁️' : '🙈'}</span>
                </div>

                {/* Grouped nav links */}
                {SIDEBAR_GROUPS.map((group) => (
                  <div key={group.label} style={{ marginBottom: '12px' }}>
                    <div style={{
                      fontSize: '9px', fontWeight: '800', color: 'var(--text-secondary, #656d76)',
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                      padding: '0 8px 6px',
                    }}>{group.label}</div>
                    {group.items.map(item => {
                      const active = location.pathname === item.to
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setSidebarOpen(false)}
                          style={memberLink(active)}
                          onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--border-muted, rgba(240,246,252,0.05))'; e.currentTarget.style.color = 'var(--text-primary, #f0f6fc)' } }}
                          onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary, #8b949e)' } }}
                        >
                          <span style={{ fontSize: '15px' }}>{item.icon}</span>
                          <div>
                            <div style={{ lineHeight: 1.2 }}>{item.label}</div>
                            {!active && <div style={{ fontSize: '9.5px', color: 'var(--text-secondary, #656d76)', marginTop: '1px' }}>{item.desc}</div>}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                ))}
              </>
            ) : (
              <div style={{ padding: '24px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔐</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary, #656d76)', marginBottom: '14px' }}>Masuk untuk mengakses menu nasabah</div>
                <Link to="/login" onClick={() => setSidebarOpen(false)} style={{
                  display: 'inline-block', padding: '8px 20px', borderRadius: '8px',
                  background: 'linear-gradient(135deg, #d4a853, #b8892e)',
                  color: '#0d1117', fontWeight: '800', textDecoration: 'none', fontSize: '12px',
                }}>Masuk Sekarang</Link>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sidebar footer — command palette shortcut */}
      <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(240,246,252,0.06)' }}>
        <button
          onClick={openCommandPalette}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: '10px',
            border: '1px solid rgba(240,246,252,0.1)',
            background: 'rgba(240,246,252,0.04)',
            color: '#656d76', fontSize: '12px', fontWeight: '600',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(240,246,252,0.08)'; e.currentTarget.style.color = '#8b949e' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(240,246,252,0.04)'; e.currentTarget.style.color = '#656d76' }}
        >
          <span>🔍</span>
          <span style={{ flex: 1 }}>Pencarian Cepat</span>
          <kbd style={{ background: 'rgba(240,246,252,0.1)', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace' }}>⌘K</kbd>
        </button>
      </div>
    </div>
  )

  // ── If Virtual Office → no sidebar/topbar chrome ────────────────────────────
  if (isVirtualOffice) {
    return (
      <>
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
          <Outlet />
        </div>
        <CommandPalette />
        {showLogout && (
          <LogoutModal
            onConfirm={handleLogoutConfirm}
            onCancel={() => setShowLogout(false)}
            loading={loggingOut}
          />
        )}
        <style>{layoutCSS}</style>
      </>
    )
  }

  // ── Normal pages → sidebar + topbar ────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden', background: 'var(--bg, #0d1117)' }}>

      {/* Logout Modal */}
      {showLogout && (
        <LogoutModal
          onConfirm={handleLogoutConfirm}
          onCancel={() => setShowLogout(false)}
          loading={loggingOut}
        />
      )}

      {/* ─── Mobile Backdrop ─── */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 149,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* ─── Topbar ───────────────────────────────────────────────────────── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '56px', zIndex: 100,
        background: 'var(--glass2, rgba(13,17,23,0.92))',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border, rgba(240,246,252,0.08))',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
      }}>
        {/* Left: Hamburger (mobile) + Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Buka sidebar"
            className="mobile-only"
            style={{
              width: '34px', height: '34px', borderRadius: '8px', border: 'none',
              background: 'rgba(240,246,252,0.08)', color: 'var(--text-secondary, #8b949e)',
              cursor: 'pointer', fontSize: '16px', display: 'none', placeItems: 'center',
            }}
          >☰</button>

          {/* Logo — goes to virtual office */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', flexShrink: 0 }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #d4a853, #b8892e)',
              display: 'grid', placeItems: 'center',
              color: '#0d1117', fontWeight: '900', fontSize: '14px',
              boxShadow: '0 2px 8px rgba(212,168,83,0.35)',
            }}>N</div>
            <span style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-primary, #f0f6fc)', letterSpacing: '0.03em', whiteSpace: 'nowrap' }} className="hide-mobile-sm">
              NARAYAN{' '}
              <span style={{ background: '#d4a853', color: '#0d1117', padding: '1px 5px', borderRadius: '4px', fontSize: '8px', fontWeight: '800' }}>VIRTUAL BANK</span>
            </span>
          </Link>

          {/* Admin badge in topbar (desktop, only for admin users) */}
          {isAdmin && (
            <Link
              to="/admin"
              className="hide-mobile"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '4px 10px', borderRadius: '8px', textDecoration: 'none',
                fontSize: '11px', fontWeight: '800', whiteSpace: 'nowrap',
                background: location.pathname.startsWith('/admin')
                  ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
                  : 'rgba(139,92,246,0.15)',
                color: location.pathname.startsWith('/admin') ? '#fff' : '#c4b5fd',
                border: '1px solid rgba(139,92,246,0.4)',
                marginLeft: '8px',
                transition: 'all 0.15s',
              }}
            >
              <span>🛡️</span><span>Admin Console</span>
            </Link>
          )}
        </div>

        {/* Right: Notif + Search + Profile dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Search shortcut */}
          <button
            type="button" onClick={openCommandPalette}
            title="Pencarian Cepat (⌘K)"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 10px', borderRadius: '8px',
              background: 'rgba(240,246,252,0.06)',
              border: '1px solid var(--border, rgba(240,246,252,0.1))',
              color: 'var(--text-secondary, #8b949e)', fontSize: '11.5px', cursor: 'pointer',
            }}
          >
            <span>🔍</span>
            <span className="hide-mobile" style={{ fontSize: '11px', fontWeight: '600' }}>Cari</span>
            <kbd className="hide-mobile" style={{ background: 'rgba(240,246,252,0.1)', padding: '1px 5px', borderRadius: '4px', fontSize: '9px', fontFamily: 'monospace' }}>⌘K</kbd>
          </button>

          {/* Notifications */}
          {user && (
            <Link
              to="/notifications"
              aria-label="Notifikasi"
              style={{
                position: 'relative', width: '34px', height: '34px',
                borderRadius: '8px', display: 'grid', placeItems: 'center',
                background: 'rgba(240,246,252,0.06)',
                border: '1px solid rgba(240,246,252,0.08)',
                textDecoration: 'none', fontSize: '15px',
              }}
            >
              🔔
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '-3px', right: '-3px',
                  background: '#ef4444', color: '#fff',
                  fontSize: '8px', fontWeight: '900',
                  minWidth: '15px', height: '15px', borderRadius: '99px',
                  display: 'grid', placeItems: 'center', padding: '0 3px',
                  border: '2px solid #0d1117',
                }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </Link>
          )}

          {/* Profile dropdown or login buttons */}
          {user ? (
            <ProfileDropdown
              user={user}
              profile={profile}
              isAdmin={isAdmin}
              onLogoutRequest={() => setShowLogout(true)}
              theme={theme}
              toggleTheme={toggleTheme}
            />
          ) : (
            <div style={{ display: 'flex', gap: '6px' }}>
              <Link to="/login" style={{
                padding: '6px 12px', borderRadius: '8px',
                border: '1px solid rgba(240,246,252,0.1)',
                color: '#8b949e', fontSize: '11.5px', fontWeight: '700',
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
              }}>Masuk</Link>
              <Link to="/register" style={{
                padding: '6px 12px', borderRadius: '8px',
                background: 'linear-gradient(135deg, #d4a853, #b8892e)',
                color: '#0d1117', fontSize: '11.5px', fontWeight: '800',
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
              }}>Daftar</Link>
            </div>
          )}
        </div>
      </header>

      {/* ─── Body: Desktop Sidebar + Main Content ─────────────────────── */}
      <div style={{ display: 'flex', flex: 1, paddingTop: '56px', minHeight: 'calc(100vh - 56px)' }}>

        {/* ── Desktop Sidebar (fixed left) ── */}
        <aside
          className="desktop-sidebar"
          style={{
            width: '240px', flexShrink: 0,
            background: 'var(--bg-surface, #161b22)',
            borderRight: '1px solid var(--border, rgba(240,246,252,0.08))',
            position: 'fixed', top: '56px', left: 0,
            height: 'calc(100vh - 56px)',
            overflowY: 'auto',
            zIndex: 90,
          }}
        >
          <SidebarContent />
        </aside>

        {/* ── Mobile Drawer Sidebar ── */}
        <aside
          className="mobile-sidebar"
          style={{
            position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 150,
            width: '280px',
            background: 'var(--bg-surface, #161b22)',
            borderRight: '1px solid var(--border, rgba(240,246,252,0.1))',
            boxShadow: '4px 0 32px rgba(0,0,0,0.6)',
            overflowY: 'auto',
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <SidebarContent />
        </aside>

        {/* ── Main Content ── */}
        <main style={{
          flex: 1,
          marginLeft: '240px',    /* equal to sidebar width on desktop */
          minWidth: 0,
          minHeight: 'calc(100vh - 56px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: 'clamp(16px, 2.5vw, 32px)',
          paddingBottom: '80px',
        }}
          className="main-content"
        >
          <Outlet />
        </main>
      </div>

      {/* ─── Responsive CSS ─── */}
      <style>{layoutCSS}</style>

      {/* Command Palette */}
      <CommandPalette />
    </div>
  )
}

const layoutCSS = `
  @media (max-width: 768px) {
    .desktop-sidebar   { display: none !important; }
    .mobile-only       { display: grid !important; }
    .hide-mobile       { display: none !important; }
    .main-content      { margin-left: 0 !important; }
  }
  @media (min-width: 769px) {
    .mobile-sidebar    { display: none !important; }
    .mobile-only       { display: none !important; }
    .mobile-close-btn  { display: none !important; }
    .hide-mobile-sm    { display: inline !important; }
  }
  @media (max-width: 480px) {
    .hide-mobile-sm    { display: none !important; }
  }

  @keyframes fadeIn   { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp  { from { opacity: 0; transform: translateY(20px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
  @keyframes slideDown{ from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes spin     { to { transform: rotate(360deg) } }

  /* Sidebar scrollbar */
  .desktop-sidebar::-webkit-scrollbar { width: 4px; }
  .desktop-sidebar::-webkit-scrollbar-track { background: transparent; }
  .desktop-sidebar::-webkit-scrollbar-thumb { background: rgba(240,246,252,0.1); border-radius: 4px; }

  /* Main content scrollbar */
  .main-content::-webkit-scrollbar { width: 6px; }
  .main-content::-webkit-scrollbar-track { background: transparent; }
  .main-content::-webkit-scrollbar-thumb { background: rgba(240,246,252,0.08); border-radius: 6px; }
  .main-content::-webkit-scrollbar-thumb:hover { background: rgba(240,246,252,0.15); }

  /* Light mode sidebar & topbar overrides */
  body.light-mode .desktop-sidebar,
  body.light-mode .mobile-sidebar {
    background: #ffffff !important;
    border-right-color: rgba(15,23,42,0.1) !important;
  }
  body.light-mode header {
    background: rgba(255,255,255,0.97) !important;
    border-bottom-color: rgba(15,23,42,0.1) !important;
  }
  body.light-mode .main-content {
    background: #f8fafc !important;
    color: #0f172a !important;
  }
  /* Sidebar link text in light mode */
  body.light-mode .desktop-sidebar *,
  body.light-mode .mobile-sidebar * {
    color: inherit;
  }
  /* Sidebar topbar button backgrounds */
  body.light-mode header button,
  body.light-mode header a {
    color: inherit;
  }
`
