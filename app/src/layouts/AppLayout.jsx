import { useState, useEffect, useCallback } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/providers/AuthProvider'
import { useUI } from '../app/providers/UIProvider'
import { CommandPalette } from '../components/ui/CommandPalette'
import { supabase } from '../services/supabase/client'
import { subscribeToNotifications } from '../services/realtime/realtimeService'
import { formatRupiah } from '../utils/format'

// ─── MEMBER MENU (hanya untuk nasabah) ───────────────────────────────────────
const MEMBER_NAV = [
  { to: '/',             label: 'Kantor 3D',  icon: '🏛️' },
  { to: '/dashboard',   label: 'Dashboard',   icon: '📊' },
  { to: '/deposit',     label: 'Setor',       icon: '📥' },
  { to: '/withdrawal',  label: 'Tarik',       icon: '📤' },
  { to: '/transactions',label: 'Riwayat',     icon: '📋' },
  { to: '/box/activate',label: 'Kotak NFC',   icon: '📦' },
  { to: '/reports',     label: 'Laporan',     icon: '📈' },
]

// ─── ADMIN MENU (hanya di drawer bila isAdmin) ────────────────────────────────
const ADMIN_NAV = [
  { to: '/admin',              label: 'Ringkasan Bank',         icon: '⚡' },
  { to: '/admin/accounts',     label: 'Review Pengajuan',       icon: '💳' },
  { to: '/admin/members',      label: 'Data Anggota',           icon: '👥' },
  { to: '/admin/boxes',        label: 'Kotak Tabungan',         icon: '📦' },
  { to: '/admin/nfc',          label: 'Tulis Tag NFC',          icon: '📡' },
  { to: '/admin/transactions', label: 'Monitor Mutasi',         icon: '💸' },
  { to: '/admin/audit',        label: 'Audit Trail',            icon: '🛡️' },
]

export default function AppLayout() {
  const { user, profile, isAdmin, signOut } = useAuth()
  const { theme, toggleTheme, openCommandPalette } = useUI()
  const location = useLocation()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount]     = useState(0)
  const [totalBalance, setTotalBalance]   = useState(0)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [mobileOpen, setMobileOpen]       = useState(false)
  const [drawerTab, setDrawerTab]         = useState('member') // 'member' | 'admin'

  const isVirtualOffice = location.pathname === '/'

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // Switch drawer tab automatically based on current page
  useEffect(() => {
    if (location.pathname.startsWith('/admin')) setDrawerTab('admin')
    else setDrawerTab('member')
  }, [location.pathname])

  useEffect(() => {
    if (!user) return
    async function loadQuickData() {
      try {
        const { data: accounts } = await supabase
          .from('accounts')
          .select('book_balance')
          .eq('user_id', user.id)
          .eq('status', 'ACTIVE')
        if (accounts) {
          const sum = accounts.reduce((acc, a) => acc + Number(a.book_balance || 0), 0)
          setTotalBalance(sum)
        }
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false)
        setUnreadCount(count || 0)
      } catch (err) {
        console.warn('loadQuickData fallback:', err?.message || err)
      }
    }
    loadQuickData()
    const unsub = subscribeToNotifications(user.id, () => {
      setUnreadCount((c) => c + 1)
    })
    return () => unsub?.()
  }, [user])

  const userInitial = profile?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || '?'
  const userName    = profile?.full_name || user?.email?.split('@')[0] || 'Member'

  // ─── Shared styles ──────────────────────────────────────────────────────────
  const memberLinkStyle = (isActive) => ({
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '9px 12px', borderRadius: '10px', textDecoration: 'none',
    marginBottom: '2px', fontSize: '13px', fontWeight: isActive ? '800' : '600',
    color: isActive ? '#0d1117' : 'var(--text-secondary, #8b949e)',
    background: isActive ? 'linear-gradient(135deg, #d4a853, #b8892e)' : 'transparent',
    boxShadow: isActive ? '0 4px 12px rgba(212,168,83,0.35)' : 'none',
    transition: 'all 0.15s ease',
  })

  const adminLinkStyle = (isActive) => ({
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 12px', borderRadius: '10px', textDecoration: 'none',
    marginBottom: '2px', fontSize: '12.5px', fontWeight: isActive ? '700' : '600',
    color: isActive ? '#fff' : '#c4b5fd',
    background: isActive
      ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
      : 'rgba(139,92,246,0.08)',
    boxShadow: isActive ? '0 4px 12px rgba(139,92,246,0.4)' : 'none',
    border: isActive ? '1px solid rgba(139,92,246,0.4)' : '1px solid transparent',
    transition: 'all 0.15s ease',
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflowX: 'hidden' }}>

      {/* ─── Mobile Backdrop ──────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 149,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* ─── Mobile Drawer ────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 150,
        width: '290px',
        background: drawerTab === 'admin'
          ? 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)'
          : 'var(--bg-elevated, #1c2128)',
        borderRight: drawerTab === 'admin'
          ? '1px solid rgba(139,92,246,0.25)'
          : '1px solid var(--border, rgba(240,246,252,0.1))',
        boxShadow: '4px 0 32px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
      }}>
        {/* ── Drawer Header ── */}
        <div style={{
          padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: drawerTab === 'admin'
            ? 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(212,168,83,0.05))'
            : 'linear-gradient(135deg, rgba(212,168,83,0.08), rgba(16,185,129,0.04))',
          borderBottom: drawerTab === 'admin'
            ? '1px solid rgba(139,92,246,0.2)'
            : '1px solid var(--border, rgba(240,246,252,0.1))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: drawerTab === 'admin'
                ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
                : 'linear-gradient(135deg, #d4a853, #b8892e)',
              display: 'grid', placeItems: 'center',
              fontWeight: '900', fontSize: '16px',
              color: drawerTab === 'admin' ? '#fff' : '#0d1117',
              boxShadow: drawerTab === 'admin'
                ? '0 4px 12px rgba(139,92,246,0.4)'
                : '0 4px 12px rgba(212,168,83,0.35)',
            }}>{drawerTab === 'admin' ? 'A' : 'N'}</div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#f0f6fc', letterSpacing: '0.03em' }}>
                {drawerTab === 'admin' ? 'ADMIN CONSOLE' : 'NARAYAN BANK'}
              </div>
              <div style={{ fontSize: '10px', fontWeight: '600', color: drawerTab === 'admin' ? '#8b5cf6' : 'var(--text-muted, #656d76)' }}>
                {drawerTab === 'admin' ? '🛡️ Konsol Administrator' : '👤 Portal Nasabah'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            style={{
              width: '28px', height: '28px', borderRadius: '6px', border: 'none',
              background: 'rgba(240,246,252,0.08)', color: '#8b949e',
              cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: '14px',
            }}
          >✕</button>
        </div>

        {/* ── Tab Switcher (hanya admin) ── */}
        {isAdmin && (
          <div style={{
            display: 'flex', padding: '8px', gap: '4px',
            borderBottom: '1px solid rgba(240,246,252,0.08)',
            background: 'rgba(0,0,0,0.2)',
          }}>
            <button
              onClick={() => setDrawerTab('member')}
              style={{
                flex: 1, padding: '7px 4px', borderRadius: '8px', border: 'none',
                fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                background: drawerTab === 'member' ? 'rgba(212,168,83,0.2)' : 'transparent',
                color: drawerTab === 'member' ? '#d4a853' : '#656d76',
                borderBottom: drawerTab === 'member' ? '2px solid #d4a853' : '2px solid transparent',
                transition: 'all 0.15s ease',
              }}
            >
              👤 Nasabah
            </button>
            <button
              onClick={() => setDrawerTab('admin')}
              style={{
                flex: 1, padding: '7px 4px', borderRadius: '8px', border: 'none',
                fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                background: drawerTab === 'admin' ? 'rgba(139,92,246,0.2)' : 'transparent',
                color: drawerTab === 'admin' ? '#8b5cf6' : '#656d76',
                borderBottom: drawerTab === 'admin' ? '2px solid #8b5cf6' : '2px solid transparent',
                transition: 'all 0.15s ease',
              }}
            >
              🛡️ Admin
            </button>
          </div>
        )}

        {/* ── User Info ── */}
        {user && (
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid rgba(240,246,252,0.06)',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
              background: isAdmin ? 'linear-gradient(135deg, #4c1d95, #2e1065)' : 'linear-gradient(135deg, #2d4a3e, #1a3028)',
              border: isAdmin ? '2px solid #8b5cf6' : '2px solid #d4a853',
              display: 'grid', placeItems: 'center',
              fontWeight: '800', fontSize: '14px',
              color: isAdmin ? '#c4b5fd' : '#d4a853',
            }}>{userInitial}</div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{userName}</span>
                {/* Role Badge */}
                <span style={{
                  fontSize: '8px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                  textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
                  background: isAdmin ? 'rgba(139,92,246,0.25)' : 'rgba(16,185,129,0.15)',
                  color: isAdmin ? '#c4b5fd' : '#10b981',
                  border: isAdmin ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(16,185,129,0.3)',
                }}>
                  {isAdmin ? '👑 Admin' : '🏦 Nasabah'}
                </span>
              </div>
              <div style={{ fontSize: '10.5px', color: '#656d76', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
            </div>
          </div>
        )}

        {/* ── Nav Links ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>

          {/* MEMBER LINKS */}
          {drawerTab === 'member' && (
            <>
              <div style={{
                fontSize: '9px', fontWeight: '800', color: 'var(--text-muted, #656d76)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                padding: '4px 8px 8px', display: 'flex', alignItems: 'center', gap: '5px',
              }}>
                <span style={{ color: '#d4a853' }}>━━</span> Menu Nasabah
              </div>
              {user
                ? MEMBER_NAV.map((link) => (
                  <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)} style={memberLinkStyle(location.pathname === link.to)}>
                    <span style={{ fontSize: '15px' }}>{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                ))
                : (
                  <div style={{ padding: '20px 12px', textAlign: 'center', color: '#656d76', fontSize: '13px' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔐</div>
                    <div style={{ marginBottom: '12px' }}>Masuk untuk mengakses menu nasabah</div>
                    <Link to="/login" onClick={() => setMobileOpen(false)} style={{
                      display: 'inline-block', padding: '8px 20px', borderRadius: '8px',
                      background: 'linear-gradient(135deg, #d4a853, #b8892e)', color: '#0d1117',
                      fontWeight: '800', textDecoration: 'none', fontSize: '12px',
                    }}>Masuk Sekarang</Link>
                  </div>
                )
              }
            </>
          )}

          {/* ADMIN LINKS */}
          {drawerTab === 'admin' && isAdmin && (
            <>
              <div style={{
                fontSize: '9px', fontWeight: '800', color: '#8b5cf6',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                padding: '4px 8px 8px', display: 'flex', alignItems: 'center', gap: '5px',
              }}>
                <span>━━</span> Konsol Administrator
              </div>
              {ADMIN_NAV.map((link) => (
                <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)} style={adminLinkStyle(location.pathname === link.to)}>
                  <span style={{ fontSize: '15px' }}>{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              ))}
              {/* Kembali ke member */}
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(240,246,252,0.06)' }}>
                <Link to="/dashboard" onClick={() => { setMobileOpen(false); setDrawerTab('member') }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', borderRadius: '8px', textDecoration: 'none',
                    color: '#d4a853', fontSize: '12px', fontWeight: '600',
                    background: 'rgba(212,168,83,0.08)', border: '1px dashed rgba(212,168,83,0.3)',
                  }}
                >
                  <span>👤</span><span>Buka Portal Nasabah ↗</span>
                </Link>
              </div>
            </>
          )}
        </div>

        {/* ── Drawer Footer ── */}
        {user && (
          <div style={{ padding: '12px', borderTop: '1px solid rgba(240,246,252,0.08)' }}>
            {drawerTab === 'member' && (
              <div style={{
                padding: '8px 12px', borderRadius: '10px', marginBottom: '8px',
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: '11px', color: '#656d76' }}>Total Saldo</span>
                <span
                  style={{ fontSize: '13px', fontWeight: '800', color: '#10b981', cursor: 'pointer' }}
                  onClick={() => setBalanceVisible(v => !v)}
                >
                  {balanceVisible ? formatRupiah(totalBalance) : '••••••'}
                </span>
              </div>
            )}
            <button
              onClick={() => signOut().then(() => navigate('/'))}
              style={{
                width: '100%', padding: '9px', borderRadius: '10px',
                border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)',
                color: '#f87171', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
              }}
            >Keluar dari Akun</button>
          </div>
        )}
      </nav>

      {/* ─── Top Navigation Bar ───────────────────────────────────────── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '58px',
        background: 'rgba(13,17,23,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border, rgba(240,246,252,0.1))',
        zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
        boxShadow: '0 1px 0 rgba(240,246,252,0.06)',
      }}>

        {/* Left: Logo + Member Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu"
            style={{
              width: '34px', height: '34px', borderRadius: '8px',
              border: 'none', background: 'rgba(240,246,252,0.08)',
              color: '#8b949e', cursor: 'pointer',
              fontSize: '16px', display: 'none', placeItems: 'center', flexShrink: 0,
            }}
            className="mobile-only"
          >☰</button>

          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', flexShrink: 0 }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #d4a853, #b8892e)',
              display: 'grid', placeItems: 'center',
              color: '#0d1117', fontWeight: '900', fontSize: '14px',
              boxShadow: '0 2px 8px rgba(212,168,83,0.35)',
            }}>N</div>
            <span style={{ fontWeight: '800', fontSize: '13px', color: '#f0f6fc', letterSpacing: '0.03em', whiteSpace: 'nowrap' }} className="hide-mobile-sm">
              NARAYAN{' '}
              <span style={{
                background: '#d4a853', color: '#0d1117',
                padding: '1px 5px', borderRadius: '4px', fontSize: '8px', fontWeight: '800',
              }}>VIRTUAL BANK</span>
            </span>
          </Link>

          {/* ── MEMBER NAV (Desktop) ── */}
          {user && (
            <nav style={{ display: 'flex', alignItems: 'center', gap: '1px', marginLeft: '8px' }} className="desktop-nav">
              {/* Divider bar */}
              <div style={{ width: '1px', height: '20px', background: 'rgba(240,246,252,0.1)', marginRight: '4px' }} />
              {/* Section label */}
              <span style={{ fontSize: '9px', fontWeight: '700', color: '#656d76', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: '6px', whiteSpace: 'nowrap' }}>
                Portal Nasabah
              </span>
              {MEMBER_NAV.filter(l => l.to !== '/').map((link) => {
                const isActive = location.pathname === link.to
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '5px 9px', borderRadius: '8px', textDecoration: 'none',
                      fontSize: '11.5px', fontWeight: isActive ? '800' : '500',
                      color: isActive ? '#0d1117' : 'var(--text-secondary, #8b949e)',
                      background: isActive ? 'linear-gradient(135deg, #d4a853, #b8892e)' : 'transparent',
                      transition: 'all 0.15s ease', whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ fontSize: '12px' }}>{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </nav>
          )}
        </div>

        {/* Right: Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>

          {/* Smart Search */}
          <button
            type="button" onClick={openCommandPalette}
            title="Cari & Jalankan Perintah (Cmd+K / Ctrl+K)"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 10px', borderRadius: '8px',
              background: 'rgba(240,246,252,0.06)',
              border: '1px solid rgba(240,246,252,0.1)',
              color: '#8b949e', fontSize: '11.5px', cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span>🔍</span>
            <span className="hide-mobile" style={{ fontSize: '11px', fontWeight: '600' }}>Cari</span>
            <kbd className="hide-mobile" style={{
              background: 'rgba(240,246,252,0.1)', padding: '1px 5px',
              borderRadius: '4px', fontSize: '9px', fontFamily: 'monospace',
            }}>⌘K</kbd>
          </button>

          {/* Theme toggle */}
          <button
            type="button" onClick={toggleTheme}
            title={`Ubah ke ${theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}`}
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              border: '1px solid rgba(240,246,252,0.1)',
              background: 'rgba(240,246,252,0.06)',
              color: '#8b949e', cursor: 'pointer',
              display: 'grid', placeItems: 'center', fontSize: '13px',
              transition: 'all 0.15s ease',
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {user ? (
            <>
              {/* Balance Pill (Desktop) */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                  padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                }}
                className="hide-mobile"
                onClick={() => setBalanceVisible(v => !v)}
              >
                <span style={{ color: '#656d76', fontSize: '9.5px' }}>Saldo</span>
                <b style={{ color: '#10b981', fontSize: '11.5px' }}>
                  {balanceVisible ? formatRupiah(totalBalance) : '••••••'}
                </b>
                <span style={{ fontSize: '9px', color: '#656d76' }}>{balanceVisible ? '👁️' : '🙈'}</span>
              </div>

              {/* Notifications */}
              <Link
                to="/notifications"
                aria-label="Notifikasi"
                style={{
                  position: 'relative', width: '32px', height: '32px',
                  borderRadius: '8px', display: 'grid', placeItems: 'center',
                  background: 'rgba(240,246,252,0.08)',
                  textDecoration: 'none', fontSize: '14px',
                  transition: 'background 0.15s',
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

              {/* ── ADMIN PORTAL BUTTON (hanya jika isAdmin) ── */}
              {isAdmin && (
                <Link
                  to="/admin"
                  title="Masuk ke Konsol Administrator"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '5px 10px', borderRadius: '8px', textDecoration: 'none',
                    fontSize: '11px', fontWeight: '800', whiteSpace: 'nowrap',
                    background: location.pathname.startsWith('/admin')
                      ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
                      : 'rgba(139,92,246,0.15)',
                    color: location.pathname.startsWith('/admin') ? '#fff' : '#c4b5fd',
                    border: '1px solid rgba(139,92,246,0.4)',
                    boxShadow: location.pathname.startsWith('/admin') ? '0 4px 12px rgba(139,92,246,0.4)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                  className="hide-mobile"
                >
                  <span>🛡️</span>
                  <span>Admin Console</span>
                  <span style={{
                    fontSize: '8px', background: 'rgba(255,255,255,0.15)',
                    padding: '1px 4px', borderRadius: '3px', fontWeight: '900',
                  }}>ADMIN</span>
                </Link>
              )}

              {/* Profile Avatar + Name */}
              <Link
                to="/profile"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  background: isAdmin ? 'linear-gradient(135deg, #4c1d95, #2e1065)' : 'linear-gradient(135deg, #2d4a3e, #1a3028)',
                  border: isAdmin ? '2px solid rgba(139,92,246,0.6)' : '2px solid rgba(212,168,83,0.5)',
                  display: 'grid', placeItems: 'center',
                  fontWeight: '800', fontSize: '12px',
                  color: isAdmin ? '#c4b5fd' : '#d4a853',
                  transition: 'border-color 0.2s',
                }}>{userInitial}</div>
                <div className="hide-mobile" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: '#8b949e', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {userName}
                  </span>
                  <span style={{
                    fontSize: '8px', fontWeight: '800', textTransform: 'uppercase',
                    color: isAdmin ? '#8b5cf6' : '#10b981',
                    letterSpacing: '0.05em',
                  }}>
                    {isAdmin ? '👑 Admin' : '🏦 Nasabah'}
                  </span>
                </div>
              </Link>

              {/* Sign out */}
              <button
                onClick={() => signOut().then(() => navigate('/'))}
                className="hide-mobile"
                style={{
                  padding: '5px 10px', borderRadius: '8px',
                  border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.08)', color: '#f87171',
                  fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                  transition: 'all 0.15s ease', whiteSpace: 'nowrap',
                }}
              >Keluar</button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '6px' }}>
              <Link to="/login" style={{
                padding: '6px 12px', borderRadius: '8px',
                border: '1px solid rgba(240,246,252,0.1)',
                color: '#8b949e', fontSize: '11.5px', fontWeight: '700', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center',
              }}>Masuk</Link>
              <Link to="/register" style={{
                padding: '6px 12px', borderRadius: '8px',
                background: 'linear-gradient(135deg, #d4a853, #b8892e)', color: '#0d1117',
                fontSize: '11.5px', fontWeight: '800', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center',
              }}>Daftar</Link>
            </div>
          )}

          {/* Mobile hamburger (kanan) */}
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
            style={{
              width: '34px', height: '34px', borderRadius: '8px', border: 'none',
              background: 'rgba(240,246,252,0.08)',
              color: '#8b949e', cursor: 'pointer',
              fontSize: '16px', display: 'none', placeItems: 'center',
            }}
            className="mobile-only"
          >☰</button>
        </div>
      </header>

      {/* ─── Main Content ─────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        paddingTop: isVirtualOffice ? 0 : '72px',
        paddingBottom: isVirtualOffice ? 0 : '60px',
        minHeight: isVirtualOffice ? '100vh' : 'calc(100vh - 72px)',
        overflowY: isVirtualOffice ? 'hidden' : 'visible',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <Outlet />
      </main>

      {/* ─── Responsive CSS ───────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-nav   { display: none !important; }
          .mobile-only   { display: grid !important; }
          .hide-mobile   { display: none !important; }
        }
        @media (min-width: 769px) {
          .mobile-only        { display: none !important; }
          .hide-mobile-sm     { display: inline !important; }
        }
        @media (max-width: 480px) {
          .hide-mobile-sm { display: none !important; }
        }
        header a:hover { opacity: 0.85; }
        header button:hover { opacity: 0.8; }
      `}</style>

      {/* Intelligent Command Palette (Cmd+K) */}
      <CommandPalette />
    </div>
  )
}
