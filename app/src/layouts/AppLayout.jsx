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
  }, [user])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Top Navigation Bar */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '60px',
        background: 'rgba(23, 33, 45, 0.88)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(220, 230, 240, 0.12)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <span style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #e1bd7b, #c39a58)',
              display: 'grid',
              placeItems: 'center',
              color: '#17212d',
              fontWeight: '900',
              fontSize: '14px',
            }}>N</span>
            <span style={{ fontWeight: '800', fontSize: '14px', color: '#edf2f7', letterSpacing: '0.03em' }}>
              NARAYAN <small style={{ background: '#c39a58', color: '#17212d', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '800' }}>VIRTUAL BANK</small>
            </span>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
            <Link to="/" className={`btn btn-sm ${isVirtualOffice ? 'btn-primary' : 'btn-secondary'}`}>
              🏛️ Kantor 3D
            </Link>
            {user && (
              <>
                <Link to="/dashboard" className={`btn btn-sm ${location.pathname === '/dashboard' ? 'btn-primary' : 'btn-secondary'}`}>
                  📊 Dashboard
                </Link>
                <Link to="/deposit" className={`btn btn-sm ${location.pathname === '/deposit' ? 'btn-primary' : 'btn-secondary'}`}>
                  📥 Setor Tabungan
                </Link>
                <Link to="/withdrawal" className={`btn btn-sm ${location.pathname === '/withdrawal' ? 'btn-primary' : 'btn-secondary'}`}>
                  📤 Tarik Tabungan
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
              <Link to="/admin" style={{ background: '#9b59b6', color: '#fff', border: 'none' }} className="btn btn-sm">
                🛡️ Panel Admin
              </Link>
            )}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.06)', padding: '4px 12px', borderRadius: '20px' }}>
                <span style={{ color: 'var(--fg-muted)', fontSize: '11px' }}>Saldo:</span>
                <b style={{ color: 'var(--accent2)', fontSize: '13px' }}>{formatRupiah(totalBalance)}</b>
              </div>

              <Link to="/notifications" style={{ position: 'relative', padding: '6px 10px', background: 'var(--section-bg)', borderRadius: '10px', textDecoration: 'none' }}>
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
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#edf2f7' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#34495e', display: 'grid', placeItems: 'center', fontWeight: '800', fontSize: '12px' }}>
                  {profile?.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: '12px', fontWeight: '700' }}>{profile?.full_name || user.email?.split('@')[0]}</span>
              </Link>

              <button onClick={() => signOut().then(() => navigate('/'))} className="btn btn-sm btn-danger">
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

      {/* Main Content Area */}
      <main style={{ flex: 1, paddingTop: isVirtualOffice ? 0 : '74px', height: '100%' }}>
        <Outlet />
      </main>
    </div>
  )
}

