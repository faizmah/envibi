import { useState, useEffect } from 'react'
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
  const [showBalance, setShowBalance] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isVirtualOffice = location.pathname === '/'

  useEffect(() => {
    if (!user) return

    // Ambil saldo buku & notifikasi secara aman
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

    // Realtime notification listener
    const unsub = subscribeToNotifications(user.id, () => {
      setUnreadCount((c) => c + 1)
    })

    return () => unsub?.()
  }, [user, location.pathname])

  // Tutup menu mobile ketika navigasi berubah
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Top Dynamic Navigation Bar */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '66px',
        background: 'rgba(15, 23, 33, 0.88)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        borderBottom: '1px solid rgba(220, 230, 240, 0.12)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.35)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
      }}>
        {/* Brand & Desktop Nav Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <span style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #e1bd7b 0%, #c39a58 100%)',
              display: 'grid',
              placeItems: 'center',
              color: '#17212d',
              fontWeight: '900',
              fontSize: '16px',
              boxShadow: '0 4px 12px rgba(195, 154, 88, 0.35)',
            }}>N</span>
            <span style={{ fontWeight: '900', fontSize: '15px', color: '#edf2f7', letterSpacing: '0.04em' }}>
              NARAYAN <small style={{ background: 'linear-gradient(135deg, #c39a58, #996515)', color: '#ffffff', padding: '2px 7px', borderRadius: '5px', fontSize: '10px', fontWeight: '800', letterSpacing: '0.05em' }}>VIRTUAL BANK</small>
            </span>
          </Link>

          {/* Desktop Nav Items */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }} className="desktop-nav">
            <Link to="/" className={`btn btn-sm ${isVirtualOffice ? 'btn-primary' : 'btn-secondary'}`}>
              🏛️ Kantor 3D
            </Link>
            {user && (
              <>
                <Link to="/dashboard" className={`btn btn-sm ${location.pathname === '/dashboard' ? 'btn-primary' : 'btn-secondary'}`}>
                  📊 Dashboard
                </Link>
                <Link to="/deposit" className={`btn btn-sm ${location.pathname === '/deposit' ? 'btn-primary' : 'btn-secondary'}`}>
                  📥 Setor
                </Link>
                <Link to="/withdrawal" className={`btn btn-sm ${location.pathname === '/withdrawal' ? 'btn-primary' : 'btn-secondary'}`}>
                  📤 Tarik
                </Link>
                <Link to="/box/activate" className={`btn btn-sm ${location.pathname === '/box/activate' ? 'btn-primary' : 'btn-secondary'}`}>
                  📦 Kotak NFC
                </Link>
                <Link to="/reports" className={`btn btn-sm ${location.pathname === '/reports' ? 'btn-primary' : 'btn-secondary'}`}>
                  📈 Laporan
                </Link>
              </>
            )}
            {isAdmin && (
              <Link to="/admin" style={{ background: 'linear-gradient(135deg, #8e44ad, #9b59b6)', color: '#fff', border: 'none', boxShadow: '0 2px 10px rgba(142, 68, 173, 0.4)' }} className="btn btn-sm">
                🛡️ Panel Admin
              </Link>
            )}
          </nav>
        </div>

        {/* Right Action Icons & Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Live Engine Indicator (Desktop) */}
          <div className="desktop-indicator" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="live-pulse" />
            <span style={{ fontSize: '11px', color: '#65d69a', fontWeight: '700' }}>NFC & Realtime Aktif</span>
          </div>

          {user ? (
            <>
              {/* Dynamic Saldo Badge with Privacy Toggle */}
              <div
                onClick={() => setShowBalance(!showBalance)}
                title="Klik untuk tampilkan / sembunyikan saldo"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(195, 154, 88, 0.25)',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'background 0.15s ease',
                }}
              >
                <span style={{ color: 'var(--fg-muted)', fontSize: '11px' }}>Saldo:</span>
                <b style={{ color: 'var(--accent2)', fontSize: '13px' }}>
                  {showBalance ? formatRupiah(totalBalance) : 'Rp ••••••••'}
                </b>
                <span style={{ fontSize: '12px', opacity: 0.7 }}>{showBalance ? '👁️' : '🙈'}</span>
              </div>

              {/* Notification Bell */}
              <Link to="/notifications" style={{ position: 'relative', padding: '8px 12px', background: 'var(--section-bg)', borderRadius: '12px', textDecoration: 'none', border: '1px solid var(--border)' }}>
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: '#ff4d4f',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: '900',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: '0 0 10px rgba(255, 77, 79, 0.6)',
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              {/* Profile Link */}
              <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#edf2f7' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #176b55, #2ecc71)', display: 'grid', placeItems: 'center', fontWeight: '800', fontSize: '12px', color: '#fff' }}>
                  {profile?.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                </div>
                <span className="desktop-username" style={{ fontSize: '12px', fontWeight: '700' }}>
                  {profile?.full_name?.split(' ')[0] || user.email?.split('@')[0]}
                </span>
              </Link>

              {/* Mobile Hamburger Button */}
              <button
                className="mobile-hamburger-btn"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                style={{
                  display: 'none',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '20px',
                  color: '#edf2f7',
                  padding: '6px',
                }}
              >
                {mobileMenuOpen ? '✕' : '☰'}
              </button>

              <button onClick={() => signOut().then(() => navigate('/'))} className="btn btn-sm btn-danger desktop-nav">
                Keluar
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Link to="/login" className="btn btn-sm btn-secondary">Masuk</Link>
              <Link to="/register" className="btn btn-sm btn-primary">Daftar Member</Link>
            </div>
          )}
        </div>
      </header>

      {/* Slide-in Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 10, 16, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 99,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="dynamic-fade-in"
            style={{
              width: '280px',
              height: '100%',
              background: '#15212e',
              borderLeft: '1px solid rgba(220, 230, 240, 0.1)',
              padding: '80px 20px 30px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '-8px 0 30px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--fg-muted)', display: 'block' }}>Masuk Sebagai</span>
              <strong style={{ fontSize: '15px', color: '#edf2f7' }}>{profile?.full_name || user?.email}</strong>
            </div>

            <Link to="/" className={`btn ${isVirtualOffice ? 'btn-primary' : 'btn-secondary'} btn-full`}>
              🏛️ Kantor 3D
            </Link>
            <Link to="/dashboard" className={`btn ${location.pathname === '/dashboard' ? 'btn-primary' : 'btn-secondary'} btn-full`}>
              📊 Dashboard Tabungan
            </Link>
            <Link to="/deposit" className={`btn ${location.pathname === '/deposit' ? 'btn-primary' : 'btn-secondary'} btn-full`}>
              📥 Setor Tabungan
            </Link>
            <Link to="/withdrawal" className={`btn ${location.pathname === '/withdrawal' ? 'btn-primary' : 'btn-secondary'} btn-full`}>
              📤 Tarik Tabungan
            </Link>
            <Link to="/box/activate" className={`btn ${location.pathname === '/box/activate' ? 'btn-primary' : 'btn-secondary'} btn-full`}>
              📦 Aktivasi Kotak NFC
            </Link>
            <Link to="/reports" className={`btn ${location.pathname === '/reports' ? 'btn-primary' : 'btn-secondary'} btn-full`}>
              📈 Laporan Keuangan
            </Link>
            <Link to="/profile" className={`btn ${location.pathname === '/profile' ? 'btn-primary' : 'btn-secondary'} btn-full`}>
              👤 Profil Saya
            </Link>

            {isAdmin && (
              <Link to="/admin" style={{ background: '#9b59b6', color: '#fff', marginTop: '10px' }} className="btn btn-full">
                🛡️ Panel Administrator
              </Link>
            )}

            <button
              onClick={() => {
                setMobileMenuOpen(false)
                signOut().then(() => navigate('/'))
              }}
              className="btn btn-danger btn-full"
              style={{ marginTop: 'auto' }}
            >
              🚪 Keluar dari Akun
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main style={{ flex: 1, paddingTop: isVirtualOffice ? 0 : '80px', paddingBottom: isVirtualOffice ? 0 : '50px', height: '100%' }}>
        <Outlet />
      </main>
    </div>
  )
}

