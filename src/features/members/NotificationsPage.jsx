import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { supabase } from '../../services/supabase/client'
import { subscribeToNotifications } from '../../services/realtime/realtimeService'
import { formatRelativeTime } from '../../utils/format'

export default function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const loadNotifications = async () => {
    if (!user) return
    setLoading(true)

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (data) setNotifications(data)
    setLoading(false)
  }

  useEffect(() => {
    loadNotifications()

    const unsub = subscribeToNotifications(user?.id, () => {
      loadNotifications()
    })

    return () => unsub?.()
  }, [user])

  const handleMarkAsRead = async (id) => {
    await supabase.rpc('mark_notification_read', { p_notification_id: id })
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
  }

  const handleMarkAllRead = async () => {
    await supabase.rpc('mark_all_notifications_read')
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--fg-muted)' }}>Memuat notifikasi...</p>
      </div>
    )
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div style={{ maxWidth: '720px', margin: '20px auto 60px', padding: '0 20px' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>Notifikasi Aktivitas</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: '12px' }}>
              Pembaruan realtime rekening, pengiriman kotak, dan transaksi
            </p>
          </div>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="btn btn-secondary btn-sm">
              Tandai Semua Dibaca ({unreadCount})
            </button>
          )}
        </div>

        {notifications.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.is_read && handleMarkAsRead(n.id)}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: n.is_read ? 'rgba(255, 255, 255, 0.02)' : 'rgba(195, 154, 88, 0.08)',
                  border: n.is_read ? '1px solid var(--border)' : '1px solid var(--accent)',
                  cursor: n.is_read ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <b style={{ fontSize: '13px', color: n.is_read ? '#edf2f7' : 'var(--accent2)' }}>
                    {n.title}
                  </b>
                  <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>
                    {formatRelativeTime(n.created_at)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--fg-muted)', lineHeight: '1.5' }}>
                  {n.body}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-muted)' }}>
            Belum ada notifikasi baru.
          </div>
        )}
      </div>
    </div>
  )
}

