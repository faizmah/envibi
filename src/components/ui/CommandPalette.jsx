import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../../app/providers/UIProvider'
import { useAuth } from '../../app/providers/AuthProvider'

export function CommandPalette() {
  const { commandPaletteOpen, closeCommandPalette, toggleTheme, theme } = useUI()
  const { user, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)

  const items = [
    // 3D Virtual Office
    { id: 'home', label: 'Kantor 3D Virtual Office', category: 'Navigasi', icon: '🏛️', path: '/' },

    // Member routes (Hanya untuk member; dibuang jika login sebagai Admin)
    ...(!isAdmin ? [
      { id: 'dashboard', label: 'Dashboard Rekening & Saldo', category: 'Member', icon: '📊', path: '/dashboard' },
      { id: 'deposit', label: 'Setor Mandiri (NFC Cash In)', category: 'Aksi', icon: '📥', path: '/deposit' },
      { id: 'withdrawal', label: 'Tarik Tabungan Mandiri', category: 'Aksi', icon: '📤', path: '/withdrawal' },
      { id: 'apply', label: 'Pengajuan Pembukaan Rekening Baru', category: 'Member', icon: '📝', path: '/accounts/apply' },
      { id: 'transactions', label: 'Riwayat Transaksi & Mutasi', category: 'Member', icon: '📋', path: '/transactions' },
      { id: 'box', label: 'Aktivasi Kotak Tabungan NFC Fisik', category: 'Aksi', icon: '📦', path: '/box/activate' },
      { id: 'goals', label: 'Target Tabungan (Savings Goals)', category: 'Member', icon: '🎯', path: '/goals' },
      { id: 'reports', label: 'Cetak Laporan & Rekening Koran', category: 'Member', icon: '📄', path: '/reports' },
      { id: 'nfc-scan', label: 'Pindai / Scan Kartu NFC', category: 'Aksi', icon: '📡', path: '/nfc/scan' },
      { id: 'profile', label: 'Profil Member & Data Diri', category: 'Member', icon: '👤', path: '/profile' },
    ] : []),

    // Admin routes (only visible if admin or in search)
    ...(isAdmin ? [
      { id: 'admin-dash', label: 'Panel Admin: Ringkasan Operasional', category: 'Admin', icon: '⚡', path: '/admin' },
      { id: 'admin-accs', label: 'Panel Admin: Permohonan Rekening', category: 'Admin', icon: '💳', path: '/admin/accounts' },
      { id: 'admin-members', label: 'Panel Admin: Manajemen Member', category: 'Admin', icon: '👥', path: '/admin/members' },
      { id: 'admin-boxes', label: 'Panel Admin: Kotak Tabungan & Resi', category: 'Admin', icon: '📦', path: '/admin/boxes' },
      { id: 'admin-nfc', label: 'Panel Admin: Penulisan Tag NFC', category: 'Admin', icon: '📡', path: '/admin/nfc' },
      { id: 'admin-txs', label: 'Panel Admin: Validasi Transaksi', category: 'Admin', icon: '💸', path: '/admin/transactions' },
      { id: 'admin-audit', label: 'Panel Admin: Audit Trail Log', category: 'Admin', icon: '🛡️', path: '/admin/audit' },
    ] : []),

    // Quick Actions
    {
      id: 'theme-toggle',
      label: `Ganti Tema: Ubah ke Mode ${theme === 'dark' ? 'Terang (Light)' : 'Gelap (Dark)'}`,
      category: 'Sistem',
      icon: theme === 'dark' ? '☀️' : '🌙',
      action: () => toggleTheme(),
    },
    ...(user ? [
      {
        id: 'logout',
        label: 'Keluar dari Sesi Akun (Logout)',
        category: 'Sistem',
        icon: '🚪',
        action: () => signOut().then(() => navigate('/')),
      },
    ] : [
      { id: 'login', label: 'Masuk Akun Member', category: 'Navigasi', icon: '🔑', path: '/login' },
      { id: 'register', label: 'Daftar Member Baru', category: 'Navigasi', icon: '✨', path: '/register' },
    ]),
  ]

  // Filter items based on query
  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [commandPaletteOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleSelect = (item) => {
    closeCommandPalette()
    if (item.action) {
      item.action()
    } else if (item.path) {
      navigate(item.path)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1 < filteredItems.length ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredItems.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex])
      }
    }
  }

  if (!commandPaletteOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(5, 12, 20, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'clamp(20px, 8vh, 80px) 16px',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={closeCommandPalette}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '580px',
          background: 'var(--bg-elevated, #1c2128)',
          border: '1px solid var(--border, rgba(240,246,252,0.12))',
          borderRadius: '16px',
          boxShadow: '0 25px 60px -15px rgba(0,0,0,0.8), 0 0 20px rgba(212,168,83,0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Bar Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border, rgba(240,246,252,0.08))',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '18px', color: 'var(--accent, #d4a853)' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik pencarian atau jalankan perintah... (Cth: setor, rekening, admin)"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '15px',
              fontWeight: '600',
              color: 'var(--text-primary, #f0f6fc)',
            }}
          />
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              background: 'rgba(240,246,252,0.08)',
              fontSize: '10px',
              fontWeight: '700',
              color: 'var(--text-secondary, #8b949e)',
            }}
          >
            ESC
          </span>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '8px' }}>
          {filteredItems.length > 0 ? (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(212,168,83,0.18), rgba(16,185,129,0.1))'
                      : 'transparent',
                    border: isSelected ? '1px solid rgba(212,168,83,0.3)' : '1px solid transparent',
                    transition: 'all 0.12s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '18px' }}>{item.icon}</span>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: isSelected ? '700' : '500',
                        color: isSelected ? '#fff' : 'var(--text-primary, #f0f6fc)',
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'rgba(240,246,252,0.06)',
                      color: 'var(--text-secondary, #8b949e)',
                    }}
                  >
                    {item.category}
                  </span>
                </div>
              )
            })
          ) : (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-secondary, #8b949e)', fontSize: '13px' }}>
              Tidak ada perintah yang cocok dengan &quot;{query}&quot;
            </div>
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid var(--border, rgba(240,246,252,0.08))',
            background: 'rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--text-secondary, #8b949e)',
          }}
        >
          <div style={{ display: 'flex', gap: '12px' }}>
            <span><b>↑↓</b> Navigasi</span>
            <span><b>Enter</b> Buka</span>
            <span><b>ESC</b> Tutup</span>
          </div>
          <span style={{ color: 'var(--accent, #d4a853)', fontWeight: '600' }}>Narayan Intelligent UI</span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
