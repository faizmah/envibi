import { useState, useEffect, useCallback } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/providers/AuthProvider'
import { supabase } from '../services/supabase/client'
import { subscribeToNotifications } from '../services/realtime/realtimeService'
import { formatRupiah } from '../utils/format'

export default function AppLayout() {
  const { user, profile, isAdmin, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [totalBalance, setTotalBalance] = useState(0)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const isVirtualOffice = location.pathname === '/'

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

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

  const navLinks = [
    { to: '/', label: 'Kantor 3D', icon: '🏛️' },
    ...(user ? [
      { to: '/dashboard', label: 'Dashboard', icon: '📊' },
      { to: '/deposit', label: 'Setor', icon: '📥' },
      { to: '/withdrawal', label: 'Tarik', icon: '📤' },
      { to: '/transactions', label: 'Riwayat', icon: '📋' },
      { to: '/box/activate', label: 'Kotak NFC', icon: '📦' },
      { to: '/reports', label: 'Laporan', icon: '📈' },
    ] : []),
  ]

  const userInitial = profile?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || '?'
  const userName = profile?.full_name || user?.email?.split('@')[0] || 'Member'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflowX: 'hidden' }}>
      {/* ─── Mobile Backdrop ─── */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 149,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* ─── Mobile Drawer ─── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 150,
        width: '280px',
        background: 'var(--bg-elevated, #1c2128)',
        borderRight: '1px solid var(--border, rgba(240,246,252,0.1))',
        boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        paddingTop: '0',
      }}>
        {/* Drawer Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 16px', borderBottom: '1px solid var(--border, rgba(240,246,252,0.1))',
          background: 'linear-gradient(135deg, rgba(212,168,83,0.08), rgba(16,185,129,0.04))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #d4a853, #b8892e)',
              display: 'grid', placeItems: 'center', color: '#0d1117',
              fontWeight: '900', fontSize: '16px', flexShrink: 0,
              boxShadow: '0 4px 12px rgba(212,168,83,0.35)',
            }}>N</div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary, #f0f6fc)', letterSpacing: '0.03em' }}>NARAYAN</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted, #656d76)', fontWeight: '600' }}>Virtual Bank</div>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            style={{
              width: '28px', height: '28px', borderRadius: '6px', border: 'none',
              background: 'var(--border, rgba(240,246,252,0.1))', color: 'var(--text-secondary, #8b949e)',
              cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: '14px',
            }}
          >✕</button>
        </div>

        {/* User info in drawer */}
        {user && (
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid var(--border, rgba(240,246,252,0.1))',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #2d4a3e, #1a3028)',
              border: '2px solid #d4a853',
              display: 'grid', placeItems: 'center',
              fontWeight: '800', fontSize: '14px', color: '#d4a853', flexShrink: 0,
            }}>{userInitial}</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary, #f0f6fc)' }}>{userName}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted, #656d76)' }}>{user.email}</div>
            </div>
          </div>
        )}

        {/* Nav links */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '10px', textDecoration: 'none',
                  marginBottom: '2px', fontSize: '13px', fontWeight: '600',
                  color: isActive ? '#0d1117' : 'var(--text-secondary, #8b949e)',
                  background: isActive ? '#d4a853' : 'transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: '15px' }}>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            )
          })}

          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setMobileOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '10px', textDecoration: 'none',
                marginTop: '8px', fontSize: '13px', fontWeight: '700',
                color: '#c4b5fd',
                background: 'rgba(139,92,246,0.15)',
                border: '1px solid rgba(139,92,246,0.3)',
              }}
            >
              <span>🛡️</span>
              <span>Panel Admin</span>
            </Link>
          )}
        </div>

        {/* Drawer footer */}
        {user && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border, rgba(240,246,252,0.1))' }}>
            <div style={{
              padding: '8px 12px', borderRadius: '10px', marginBottom: '8px',
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted, #656d76)' }}>Total Saldo</span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#10b981' }}>
                {balanceVisible ? formatRupiah(totalBalance) : '••••••'}
              </span>
            </div>
            <button
              onClick={() => signOut().then(() => navigate('/'))}
              style={{
                width: '100%', padding: '9px', borderRadius: '10px',
                border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)',
                color: '#f87171', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
              }}
            >Keluar dari Akun</button>
          </div>
        )}
      </nav>

      {/* ─── Top Navigation Bar ─── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '58px',
        background: 'rgba(13,17,23,0.90)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border, rgba(240,246,252,0.1))',
        zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
        boxShadow: '0 1px 0 rgba(240,246,252,0.06)',
      }}>
        {/* Left: Hamburger + Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu"
            style={{
              display: 'none',
              width: '34px', height: '34px', borderRadius: '8px',
              border: 'none', background: 'var(--border, rgba(240,246,252,0.1))',
              color: 'var(--text-secondary, #8b949e)', cursor: 'pointer',
              fontSize: '16px', placeItems: 'center',
            }}
            className="mobile-hamburger"
          >☰</button>

          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', flexShrink: 0 }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #d4a853, #b8892e)',
              display: 'grid', placeItems: 'center',
              color: '#0d1117', fontWeight: '900', fontSize: '14px',
              boxShadow: '0 2px 8px rgba(212,168,83,0.35)',
            }}>N</div>
            <span style={{ fontWeight: '800', fontSize: '13px', color: '#f0f6fc', letterSpacing: '0.03em' }} className="hide-mobile-sm">
              NARAYAN{' '}
              <span style={{
                background: '#d4a853', color: '#0d1117',
                padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '800',
              }}>VIRTUAL BANK</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '8px' }} className="desktop-nav">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '6px 10px', borderRadius: '8px', textDecoration: 'none',
                    fontSize: '12px', fontWeight: isActive ? '800' : '600',
                    color: isActive ? '#0d1117' : 'var(--text-secondary, #8b949e)',
                    background: isActive ? '#d4a853' : 'transparent',
                    transition: 'all 0.15s ease', whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontSize: '13px' }}>{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              )
            })}
            {isAdmin && (
              <Link
                to="/admin"
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 10px', borderRadius: '8px', textDecoration: 'none',
                  fontSize: '12px', fontWeight: '700', color: '#c4b5fd',
                  background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>🛡️</span><span>Admin</span>
              </Link>
            )}
          </nav>
        </div>

        {/* Right: Balance, Notif, User, Signout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {user ? (
            <>
              {/* Balance pill */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
              }}
                className="hide-mobile"
                onClick={() => setBalanceVisible(v => !v)}
              >
                <span style={{ color: 'var(--text-muted, #656d76)', fontSize: '10px' }}>Saldo</span>
                <b style={{ color: '#10b981', fontSize: '12px' }}>
                  {balanceVisible ? formatRupiah(totalBalance) : '••••••'}
                </b>
                <span style={{ fontSize: '10px', color: 'var(--text-muted, #656d76)' }}>{balanceVisible ? '👁️' : '🙈'}</span>
              </div>

              {/* Notifications */}
              <Link
                to="/notifications"
                aria-label="Notifikasi"
                style={{
                  position: 'relative', width: '34px', height: '34px',
                  borderRadius: '8px', display: 'grid', placeItems: 'center',
                  background: 'var(--border, rgba(240,246,252,0.1))',
                  textDecoration: 'none', fontSize: '15px',
                  transition: 'background 0.15s',
                }}
              >
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '-3px', right: '-3px',
                    background: '#ef4444', color: 'white',
                    fontSize: '9px', fontWeight: '900',
                    minWidth: '16px', height: '16px', borderRadius: '99px',
                    display: 'grid', placeItems: 'center', padding: '0 3px',
                    border: '2px solid #0d1117',
                  }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </Link>

              {/* Profile */}
              <Link
                to="/profile"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '7px' }}
              >
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2d4a3e, #1a3028)',
                  border: '2px solid rgba(212,168,83,0.5)',
                  display: 'grid', placeItems: 'center',
                  fontWeight: '800', fontSize: '12px', color: '#d4a853',
                  transition: 'border-color 0.2s',
                }}>{userInitial}</div>
                <span style={{
                  fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary, #8b949e)',
                  maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }} className="hide-mobile">{userName}</span>
              </Link>

              {/* Sign out */}
              <button
                onClick={() => signOut().then(() => navigate('/'))}
                className="hide-mobile"
                style={{
                  padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.08)', color: '#f87171',
                  fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                  transition: 'all 0.15s ease', whiteSpace: 'nowrap',
                }}
              >Keluar</button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '6px' }}>
              <Link to="/login" style={{
                padding: '6px 14px', borderRadius: '8px',
                border: '1px solid var(--border, rgba(240,246,252,0.1))',
                background: 'transparent', color: 'var(--text-secondary, #8b949e)',
                fontSize: '12px', fontWeight: '700', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center',
              }}>Masuk</Link>
              <Link to="/register" style={{
                padding: '6px 14px', borderRadius: '8px',
                background: '#d4a853', color: '#0d1117',
                fontSize: '12px', fontWeight: '800', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center',
              }}>Daftar</Link>
            </div>
          )}

          {/* Hamburger for mobile */}
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
            style={{
              width: '34px', height: '34px', borderRadius: '8px', border: 'none',
              background: 'var(--border, rgba(240,246,252,0.1))',
              color: 'var(--text-secondary, #8b949e)', cursor: 'pointer',
              fontSize: '16px', display: 'none', placeItems: 'center',
            }}
            className="mobile-only"
          >☰</button>
        </div>
      </header>

      {/* Main Content */}
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

      {/* Inline responsive CSS - only for the layout */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-only { display: grid !important; }
          .hide-mobile { display: none !important; }
        }
        @media (min-width: 769px) {
          .mobile-only { display: none !important; }
          .hide-mobile-sm { display: inline !important; }
        }
        @media (max-width: 480px) {
          .hide-mobile-sm { display: none !important; }
        }
        header a:hover { opacity: 0.85; }
      `}</style>
    </div>
  )
}
