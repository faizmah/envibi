import { useState, useEffect } from 'react'
import { useAuth } from '../../app/providers/AuthProvider'
import { supabase } from '../../services/supabase/client'
import { Card, Button, Badge, Modal } from '../../components/ui'

export default function ProfilePage() {
  const { user, profile, role, refreshProfile } = useAuth()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [birthDate, setBirthDate] = useState('')

  const [saving, setSaving] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setPhone(profile.phone || '')
      setAddress(profile.address || '')
      setBirthDate(profile.birth_date || '')
    }
  }, [profile])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error: err } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        birth_date: birthDate || null,
      })
      .eq('id', user.id)

    setSaving(false)

    if (err) {
      setError('Gagal memperbarui profil: ' + err.message)
    } else {
      setShowSuccessModal(true)
      refreshProfile()
    }
  }

  return (
    <div style={{ maxWidth: '680px', margin: '16px auto 60px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#d4a853', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            PENGATURAN AKUN
          </span>
          <Badge variant="success">Akun Aktif</Badge>
        </div>
        <h1 style={{ fontSize: 'clamp(20px, 3vw, 24px)', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
          Profil Saya
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
          Kelola informasi nama, kontak, dan alamat tujuan pengiriman kotak tabungan fisik Anda
        </p>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#f87171',
          fontSize: '12.5px',
          fontWeight: '600',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <Card variant="glass" style={{ padding: 'clamp(20px, 4vw, 32px)' }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Alamat Email
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'rgba(240, 246, 252, 0.04)',
                color: 'var(--text-muted)',
                fontSize: '13px',
                cursor: 'not-allowed',
                boxSizing: 'border-box',
              }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginTop: '4px' }}>
              Email akun digunakan sebagai identitas utama login
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Nama Lengkap
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Masukkan nama lengkap Anda..."
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated, #161b22)',
                color: 'var(--text-primary)',
                fontSize: '13.5px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Nomor Telepon / WhatsApp
              </label>
              <input
                type="tel"
                placeholder="0812xxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elevated, #161b22)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Tanggal Lahir
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elevated, #161b22)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Alamat Lengkap Pengiriman Kotak Fisik
            </label>
            <textarea
              rows="3"
              placeholder="Nama jalan, RT/RW, nomor rumah, kelurahan, kecamatan, kota, kode pos"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated, #161b22)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'none',
              }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginTop: '4px' }}>
              Alamat ini digunakan oleh tim logistik bank untuk mengirimkan kotak tabungan fisik ber-NFC langsung ke rumah Anda.
            </span>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '12px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border)',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Hak Akses:</span>
              <Badge variant={role === 'ADMIN' ? 'warning' : 'neutral'}>
                {role === 'ADMIN' ? '👑 Admin' : '👤 Nasabah'}
              </Badge>
            </div>

            <Button type="submit" variant="primary" loading={saving} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Perubahan Profil ➔'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Modal Sukses Update Profil */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Profil Berhasil Disimpan"
        maxWidth="420px"
      >
        <div style={{ textAlign: 'center', padding: '12px 0 6px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '2px solid rgba(16, 185, 129, 0.35)',
            display: 'grid',
            placeItems: 'center',
            fontSize: '28px',
            margin: '0 auto 16px',
          }}>
            ✓
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>
            Data Profil Diperbarui
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', margin: '0 0 20px' }}>
            Informasi identitas dan alamat pengiriman Anda telah berhasil disimpan dan disinkronkan ke seluruh sistem Narayan Bank.
          </p>
          <Button
            variant="primary"
            onClick={() => setShowSuccessModal(false)}
            style={{ width: '100%', padding: '10px' }}
          >
            Mengerti & Tutup
          </Button>
        </div>
      </Modal>
    </div>
  )
}
